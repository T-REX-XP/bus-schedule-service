/**
 * KV-based caching layer for GTFS data
 * This reduces CPU time by caching parsed data in Cloudflare KV
 */

const KV_CACHE_TTL = 6 * 60 * 60; // 6 hours in seconds

/**
 * Get data from KV cache or fallback to parsing
 */
export async function getFromKVOrParse(kv, key, parseFn, ttl = KV_CACHE_TTL) {
  if (!kv) {
    // No KV available, use parse function directly
    return await parseFn();
  }

  try {
    // Try to get from KV first
    const cached = await kv.get(key, { type: 'json' });
    if (cached) {
      console.log(`KV cache hit: ${key}`);
      return cached;
    }
  } catch (error) {
    console.error(`KV read error for ${key}:`, error);
  }

  // Cache miss or error - parse and store
  console.log(`KV cache miss: ${key}`);
  const data = await parseFn();
  
  // Store in KV for next time (async, don't wait)
  if (kv && data) {
    kv.put(key, JSON.stringify(data), { expirationTtl: ttl })
      .catch(err => console.error(`KV write error for ${key}:`, err));
  }
  
  return data;
}

/**
 * Cache routes in KV
 */
export async function getCachedRoutes(kv, gtfsUrl, parseFn) {
  return getFromKVOrParse(
    kv,
    `gtfs:routes:${hashUrl(gtfsUrl)}`,
    parseFn
  );
}

/**
 * Cache stops in KV
 */
export async function getCachedStops(kv, gtfsUrl, parseFn) {
  return getFromKVOrParse(
    kv,
    `gtfs:stops:${hashUrl(gtfsUrl)}`,
    parseFn
  );
}

/**
 * Cache trips in KV
 */
export async function getCachedTrips(kv, gtfsUrl, parseFn) {
  return getFromKVOrParse(
    kv,
    `gtfs:trips:${hashUrl(gtfsUrl)}`,
    parseFn
  );
}

/**
 * Cache departure queries (short TTL)
 */
export async function getCachedDepartures(kv, routeId, stopId, parseFn) {
  const shortTTL = 5 * 60; // 5 minutes for real-time data
  
  return getFromKVOrParse(
    kv,
    `cache:departures:${routeId}:${stopId}`,
    parseFn,
    shortTTL
  );
}

/**
 * Simple hash function for URLs
 */
function hashUrl(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Invalidate all GTFS caches (useful when data is updated)
 */
export async function invalidateGTFSCache(kv, gtfsUrl) {
  if (!kv) return;
  
  const urlHash = hashUrl(gtfsUrl);
  const keys = [
    `gtfs:routes:${urlHash}`,
    `gtfs:stops:${urlHash}`,
    `gtfs:trips:${urlHash}`,
  ];
  
  for (const key of keys) {
    try {
      await kv.delete(key);
      console.log(`Invalidated cache: ${key}`);
    } catch (error) {
      console.error(`Error invalidating ${key}:`, error);
    }
  }
}
