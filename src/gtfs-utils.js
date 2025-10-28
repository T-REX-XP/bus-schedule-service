/**
 * GTFS utilities for parsing and caching GTFS data
 */

// In-memory cache for parsed GTFS data
const cache = {
  zipData: null,
  unzipped: null,
  parsedFiles: new Map(),
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
  if (cache.zipData && cache.unzipped && now - cache.timestamp < CACHE_TTL) {
    return cache.zipData;
  }
  
  const zipData = await downloadGTFSZip(url);
  
  // Unzip once and cache
  const { unzipSync } = await import('fflate');
  cache.zipData = zipData;
  cache.unzipped = unzipSync(zipData);
  cache.parsedFiles.clear(); // Clear parsed file cache
  cache.timestamp = now;
  
  return zipData;
}

/**
 * Parse CSV from ZIP file using fflate
 */
export async function parseCSVFromZip(zipData, filename) {
  // Check if already parsed and cached
  if (cache.parsedFiles.has(filename)) {
    return cache.parsedFiles.get(filename);
  }
  
  // Dynamic import of fflate
  const { strFromU8 } = await import('fflate');
  
  if (!cache.unzipped) {
    const { unzipSync } = await import('fflate');
    cache.unzipped = unzipSync(zipData);
  }
  
  if (!cache.unzipped[filename]) {
    throw new Error(`File ${filename} not found in ZIP`);
  }
  
  const text = strFromU8(cache.unzipped[filename]);
  const rows = parseCSV(text);
  
  // Cache the parsed file (but not stop_times.txt as it's too large)
  if (filename !== 'stop_times.txt') {
    cache.parsedFiles.set(filename, rows);
  }
  
  return rows;
}

/**
 * Parse CSV from ZIP file with streaming/filtering for large files
 */
export async function parseCSVFromZipFiltered(zipData, filename, filterFn) {
  const { strFromU8 } = await import('fflate');
  
  if (!cache.unzipped) {
    const { unzipSync } = await import('fflate');
    cache.unzipped = unzipSync(zipData);
  }
  
  if (!cache.unzipped[filename]) {
    throw new Error(`File ${filename} not found in ZIP`);
  }
  
  const text = strFromU8(cache.unzipped[filename]);
  return parseCSVFiltered(text, filterFn);
}

/**
 * Parse CSV with filtering to avoid loading entire dataset
 */
function parseCSVFiltered(text, filterFn) {
  const lines = text.split('\n');
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    // Apply filter immediately to avoid storing unnecessary data
    if (filterFn(row)) {
      rows.push(row);
    }
  }
  
  return rows;
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
 * Optimized to avoid loading entire stop_times.txt into memory
 */
export async function getUpcomingDepartures(routeId, stopId, afterTime, zipData) {
  // First, get the trip IDs for this route (smaller dataset)
  const trips = await parseCSVFromZip(zipData, 'trips.txt');
  const tripIdsForRoute = new Set(
    trips.filter(t => t.route_id === routeId).map(t => t.trip_id)
  );
  
  if (tripIdsForRoute.size === 0) {
    return []; // No trips for this route
  }
  
  // Parse stop_times.txt with filtering to only get relevant rows
  const relevantStopTimes = await parseCSVFromZipFiltered(
    zipData,
    'stop_times.txt',
    (row) => tripIdsForRoute.has(row.trip_id) && row.stop_id === stopId
  );
  
  const upcoming = [];
  
  for (const st of relevantStopTimes) {
    try {
      let departureTime = parseGTFSTime(st.departure_time, afterTime);
      
      // If the departure time is in the past, it might be for the next service day
      if (departureTime < afterTime) {
        departureTime = new Date(departureTime.getTime() + 24 * 60 * 60 * 1000);
      }
      
      upcoming.push([departureTime, st]);
    } catch (error) {
      // Skip invalid times
      console.error(`Invalid time format: ${st.departure_time}`, error);
    }
  }
  
  // Sort by time
  upcoming.sort((a, b) => a[0] - b[0]);
  
  return upcoming;
}
