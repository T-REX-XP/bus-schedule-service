/**
 * Cloudflare Workers entry point for EMT Valencia Bus API
 * Node.js implementation
 */

import { parseCSVFromZip, getCachedZip, getUpcomingDepartures } from './gtfs-utils.js';

/**
 * Get GTFS URL from environment variable or use default
 */
function getGTFSUrl(env) {
  return env?.GTFS_URL || 
    "https://opendata.vlci.valencia.es/dataset/google-transit-lines-stops-bus-schedules/" +
    "resource/c81b69e6-c082-44dc-acc6-66fc417b4e66/download/google_transit.zip";
}

/**
 * Haversine formula to calculate distance between two coordinates
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  
  const lat1Rad = toRad(lat1);
  const lon1Rad = toRad(lon1);
  const lat2Rad = toRad(lat2);
  const lon2Rad = toRad(lon2);
  
  const dlat = lat2Rad - lat1Rad;
  const dlon = lon2Rad - lon1Rad;
  
  const a = Math.sin(dlat / 2) ** 2 + 
            Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dlon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * JSON response helper
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Error response helper
 */
function errorResponse(message, status = 500) {
  return jsonResponse({
    error: true,
    message,
  }, status);
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const GTFS_URL = getGTFSUrl(env);
      
      // CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
      
      // Routes
      if (path === '/' || path === '') {
        return handleRoot();
      } else if (path === '/gtfs-status') {
        return await handleGTFSStatus(GTFS_URL);
      } else if (path === '/routes') {
        return await handleRoutes(url.searchParams, GTFS_URL);
      } else if (path === '/stops') {
        return await handleStops(url.searchParams, GTFS_URL);
      } else if (path === '/find-stop') {
        return await handleFindStop(url.searchParams, GTFS_URL);
      } else if (path === '/find-route') {
        return await handleFindRoute(url.searchParams, GTFS_URL);
      } else if (path === '/departures') {
        return await handleDepartures(url.searchParams, GTFS_URL);
      } else if (path === '/stops') {
        return await handleStops(url.searchParams);
      } else if (path === '/find-stop') {
        return await handleFindStop(url.searchParams);
      } else if (path === '/find-route') {
        return await handleFindRoute(url.searchParams);
      } else if (path === '/departures') {
        return await handleDepartures(url.searchParams);
      }
      
      return jsonResponse({
        error: true,
        message: 'Not Found',
        path,
      }, 404);
      
    } catch (error) {
      console.error('Error:', error);
      return errorResponse(error.message || 'Internal Server Error');
    }
  },
};

/**
 * Root endpoint - API information
 */
function handleRoot() {
  return jsonResponse({
    status: 'running',
    service: 'EMT Valencia Bus Schedule API',
    version: '1.0.0',
    endpoints: {
      find_stop: '/find-stop?name={stop_name}',
      find_route: '/find-route?name={route_name}',
      stops: '/stops?q={search_term}',
      routes: '/routes?q={search_term}',
      departures: '/departures?route_id={route_id}&stop_id={stop_id}&limit={limit}',
      gtfs_status: '/gtfs-status',
    },
  });
}

/**
 * GTFS Status endpoint
 */
async function handleGTFSStatus(GTFS_URL) {
  try {
    const response = await fetch(GTFS_URL, { method: 'HEAD' });
    
    if (response.ok) {
      return jsonResponse({
        status: 'available',
        url: GTFS_URL,
        message: 'GTFS data source is accessible',
      });
    } else {
      return jsonResponse({
        status: 'unavailable',
        url: GTFS_URL,
        status_code: response.status,
        message: `GTFS data source returned status code ${response.status}`,
      });
    }
  } catch (error) {
    return jsonResponse({
      status: 'error',
      url: GTFS_URL,
      error: error.message,
      message: 'Failed to connect to GTFS data source',
    });
  }
}

/**
 * List routes endpoint
 */
async function handleRoutes(searchParams, GTFS_URL) {
  try {
    const q = searchParams.get('q') || '';
    const zip = await getCachedZip(GTFS_URL);
    let routes = await parseCSVFromZip(zip, 'routes.txt');
    
    // Filter if query provided
    if (q) {
      const qLower = q.toLowerCase();
      routes = routes.filter(r => 
        (r.route_id || '').toLowerCase().includes(qLower) ||
        (r.route_short_name || '').toLowerCase().includes(qLower) ||
        (r.route_long_name || '').toLowerCase().includes(qLower)
      );
    }
    
    // Sort routes
    routes.sort((a, b) => {
      const aNum = parseInt(a.route_short_name);
      const bNum = parseInt(b.route_short_name);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return (a.route_short_name || '').localeCompare(b.route_short_name || '');
    });
    
    return jsonResponse({
      count: routes.length,
      filter: q || null,
      routes: routes.map(r => ({
        route_id: r.route_id || '',
        route_short_name: r.route_short_name || '',
        route_long_name: r.route_long_name || '',
        route_type: r.route_type || '',
        route_color: r.route_color || '',
        route_text_color: r.route_text_color || '',
      })),
    });
  } catch (error) {
    return errorResponse(`Service unavailable: ${error.message}`, 503);
  }
}

/**
 * List stops endpoint
 */
async function handleStops(searchParams, GTFS_URL) {
  try {
    const q = searchParams.get('q') || '';
    const zip = await getCachedZip(GTFS_URL);
    let stops = await parseCSVFromZip(zip, 'stops.txt');
    
    // Filter if query provided
    if (q) {
      const qLower = q.toLowerCase();
      stops = stops.filter(s => 
        (s.stop_name || '').toLowerCase().includes(qLower)
      );
    }
    
    return jsonResponse({
      count: stops.length,
      filter: q || null,
      stops: stops.map(s => ({
        stop_id: s.stop_id,
        name: s.stop_name,
        lat: s.stop_lat,
        lon: s.stop_lon,
      })),
    });
  } catch (error) {
    return errorResponse(`Service unavailable: ${error.message}`, 503);
  }
}

/**
 * Find stop endpoint
 */
async function handleFindStop(searchParams, GTFS_URL) {
  try {
    const name = searchParams.get('name');
    const lat = parseFloat(searchParams.get('lat'));
    const lon = parseFloat(searchParams.get('lon'));
    const radius = parseInt(searchParams.get('radius') || '500');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const zip = await getCachedZip(GTFS_URL);
    let stops = await parseCSVFromZip(zip, 'stops.txt');
    
    // Filter by name
    if (name) {
      const nameLower = name.toLowerCase();
      stops = stops.filter(s => 
        (s.stop_name || '').toLowerCase().includes(nameLower)
      );
    }
    
    // Calculate distances if location provided
    if (!isNaN(lat) && !isNaN(lon)) {
      stops = stops.map(s => {
        const stopLat = parseFloat(s.stop_lat);
        const stopLon = parseFloat(s.stop_lon);
        const distance = haversineDistance(lat, lon, stopLat, stopLon);
        return {
          ...s,
          distance_meters: Math.round(distance * 10) / 10,
        };
      });
      
      // Filter by radius
      stops = stops.filter(s => s.distance_meters <= radius);
      
      // Sort by distance
      stops.sort((a, b) => a.distance_meters - b.distance_meters);
    } else {
      // Sort by name
      stops.sort((a, b) => (a.stop_name || '').localeCompare(b.stop_name || ''));
    }
    
    // Limit results
    stops = stops.slice(0, limit);
    
    const resultStops = stops.map(s => {
      const info = {
        stop_id: s.stop_id,
        name: s.stop_name,
        location: {
          lat: parseFloat(s.stop_lat),
          lon: parseFloat(s.stop_lon),
        },
      };
      if (s.distance_meters !== undefined) {
        info.distance_meters = s.distance_meters;
      }
      return info;
    });
    
    return jsonResponse({
      count: resultStops.length,
      search_criteria: {
        name,
        location: !isNaN(lat) && !isNaN(lon) ? { lat, lon } : null,
        radius_meters: !isNaN(lat) && !isNaN(lon) ? radius : null,
      },
      stops: resultStops,
    });
  } catch (error) {
    return errorResponse(`Service unavailable: ${error.message}`, 503);
  }
}

/**
 * Find route endpoint
 */
async function handleFindRoute(searchParams, GTFS_URL) {
  try {
    const number = searchParams.get('number');
    const name = searchParams.get('name');
    const includeStops = searchParams.get('include_stops') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const zip = await getCachedZip(GTFS_URL);
    let routes = await parseCSVFromZip(zip, 'routes.txt');
    
    // Filter by number
    if (number) {
      const numLower = number.toLowerCase();
      routes = routes.filter(r => 
        (r.route_id || '').toLowerCase() === numLower ||
        (r.route_short_name || '').toLowerCase() === numLower ||
        (r.route_id || '').toLowerCase().includes(numLower) ||
        (r.route_short_name || '').toLowerCase().includes(numLower)
      );
    }
    
    // Filter by name
    if (name) {
      const nameLower = name.toLowerCase();
      routes = routes.filter(r => 
        (r.route_long_name || '').toLowerCase().includes(nameLower)
      );
    }
    
    // Sort and limit
    routes.sort((a, b) => {
      const aNum = parseInt(a.route_short_name);
      const bNum = parseInt(b.route_short_name);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return (a.route_short_name || '').localeCompare(b.route_short_name || '');
    });
    routes = routes.slice(0, limit);
    
    // Build result
    const resultRoutes = [];
    for (const r of routes) {
      const routeInfo = {
        route_id: r.route_id || '',
        route_short_name: r.route_short_name || '',
        route_long_name: r.route_long_name || '',
        route_type: r.route_type || '',
        route_color: r.route_color || '',
        route_text_color: r.route_text_color || '',
      };
      
      if (includeStops) {
        // Get trips for this route
        const trips = await parseCSVFromZip(zip, 'trips.txt');
        const routeTrips = trips.filter(t => t.route_id === r.route_id);
        
        if (routeTrips.length > 0) {
          const tripId = routeTrips[0].trip_id;
          const stopTimes = await parseCSVFromZip(zip, 'stop_times.txt');
          let tripStops = stopTimes.filter(st => st.trip_id === tripId);
          
          // Sort by stop_sequence
          tripStops.sort((a, b) => 
            parseInt(a.stop_sequence || 0) - parseInt(b.stop_sequence || 0)
          );
          
          // Get stop details
          const stops = await parseCSVFromZip(zip, 'stops.txt');
          const stopsDict = {};
          stops.forEach(s => {
            stopsDict[s.stop_id] = s;
          });
          
          routeInfo.stops = tripStops
            .filter(st => stopsDict[st.stop_id])
            .map(st => ({
              stop_sequence: parseInt(st.stop_sequence || 0),
              stop_id: st.stop_id || '',
              stop_name: stopsDict[st.stop_id]?.stop_name || '',
              arrival_time: st.arrival_time || '',
              departure_time: st.departure_time || '',
            }));
          routeInfo.total_stops = routeInfo.stops.length;
        } else {
          routeInfo.stops = [];
          routeInfo.total_stops = 0;
        }
      }
      
      resultRoutes.push(routeInfo);
    }
    
    return jsonResponse({
      count: resultRoutes.length,
      search_criteria: {
        number,
        name,
        include_stops: includeStops,
      },
      routes: resultRoutes,
    });
  } catch (error) {
    return errorResponse(`Service unavailable: ${error.message}`, 503);
  }
}

/**
 * Departures endpoint
 */
async function handleDepartures(searchParams, GTFS_URL) {
  try {
    const routeId = searchParams.get('route_id');
    const stopId = searchParams.get('stop_id');
    const limit = parseInt(searchParams.get('limit') || '5');
    
    if (!routeId || !stopId) {
      return errorResponse('route_id and stop_id are required', 400);
    }
    
    const zip = await getCachedZip(GTFS_URL);
    const now = new Date();
    const results = await getUpcomingDepartures(routeId, stopId, now, zip);
    
    if (!results || results.length === 0) {
      return jsonResponse({
        message: `No upcoming departures found for route ${routeId} at stop ${stopId}`,
        departures: [],
      });
    }
    
    return jsonResponse({
      route_id: routeId,
      stop_id: stopId,
      departures: results.slice(0, limit).map(([depTime, st]) => ({
        departure_time: depTime.toTimeString().split(' ')[0],
        trip_id: st.trip_id,
        stop_sequence: st.stop_sequence,
      })),
    });
  } catch (error) {
    return errorResponse(`Service unavailable: ${error.message}`, 503);
  }
}
