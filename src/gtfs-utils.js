/**
 * GTFS utilities for parsing and caching GTFS data
 */

// In-memory cache
const cache = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL = 3600 * 6 * 1000; // 6 hours in milliseconds

/**
 * Download GTFS ZIP file
 */
export async function downloadGTFSZip(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download GTFS data: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    throw new Error(`Error downloading GTFS data: ${error.message}`);
  }
}

/**
 * Get cached ZIP or download fresh one
 */
export async function getCachedZip(url) {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }
  
  const zipData = await downloadGTFSZip(url);
  cache.data = zipData;
  cache.timestamp = now;
  return zipData;
}

/**
 * Parse CSV from ZIP file using fflate
 */
export async function parseCSVFromZip(zipData, filename) {
  // Dynamic import of fflate
  const { unzipSync, strFromU8 } = await import('fflate');
  
  const unzipped = unzipSync(zipData);
  
  if (!unzipped[filename]) {
    throw new Error(`File ${filename} not found in ZIP`);
  }
  
  const text = strFromU8(unzipped[filename]);
  return parseCSV(text);
}

/**
 * Simple CSV parser
 */
function parseCSV(text) {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

/**
 * Parse GTFS time format (can have hours >= 24)
 */
export function parseGTFSTime(timeStr, baseDate) {
  const [hoursStr, minutesStr, secondsStr] = timeStr.split(':');
  let hours = parseInt(hoursStr);
  const minutes = parseInt(minutesStr);
  const seconds = parseInt(secondsStr);
  
  // Calculate extra days if hours >= 24
  const extraDays = Math.floor(hours / 24);
  hours = hours % 24;
  
  // Create date
  const date = new Date(baseDate);
  date.setHours(hours, minutes, seconds, 0);
  
  // Add extra days if needed
  if (extraDays > 0) {
    date.setDate(date.getDate() + extraDays);
  }
  
  return date;
}

/**
 * Get upcoming departures for a route at a stop
 */
export async function getUpcomingDepartures(routeId, stopId, afterTime, zipData) {
  const stopTimes = await parseCSVFromZip(zipData, 'stop_times.txt');
  const trips = await parseCSVFromZip(zipData, 'trips.txt');
  
  // Get trip IDs for this route
  const tripIdsForRoute = new Set(
    trips.filter(t => t.route_id === routeId).map(t => t.trip_id)
  );
  
  const upcoming = [];
  
  for (const st of stopTimes) {
    if (tripIdsForRoute.has(st.trip_id) && st.stop_id === stopId) {
      let departureTime = parseGTFSTime(st.departure_time, afterTime);
      
      // If the departure time is in the past, it might be for the next service day
      if (departureTime < afterTime) {
        departureTime = new Date(departureTime.getTime() + 24 * 60 * 60 * 1000);
      }
      
      upcoming.push([departureTime, st]);
    }
  }
  
  // Sort by time
  upcoming.sort((a, b) => a[0] - b[0]);
  
  return upcoming;
}
