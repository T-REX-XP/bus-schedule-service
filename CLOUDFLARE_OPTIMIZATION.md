# Cloudflare Free Tier Optimization Guide

## Current Limitations

### Cloudflare Workers Free Tier
- ✅ **CPU Time**: 10ms per request
- ✅ **Memory**: 128MB
- ✅ **Requests**: 100,000/day
- ✅ **Script Size**: 1MB after compression
- ❌ **No built-in persistent storage**

## Problems with Current Implementation

1. **GTFS ZIP Download**: Takes >10ms, exceeds CPU limit
2. **In-Memory Caching**: Lost when Worker instance is recycled
3. **Large Files**: Valencia GTFS is ~50MB+, too big to process in 10ms
4. **No Persistent Cache**: Have to re-download on every cold start

## Recommended Cloudflare Services (All Have Free Tiers!)

### 1. **R2 Storage** (Recommended - Best Solution)
**Purpose**: Store pre-processed GTFS data
- ✅ Free: 10GB storage
- ✅ Free: 1 million Class A operations/month
- ✅ Free: 10 million Class B operations/month
- ✅ No egress fees

**Strategy**:
```javascript
// Store pre-parsed GTFS files as JSON
R2 Bucket:
  ├── gtfs-data/
  │   ├── routes.json          (5KB)
  │   ├── stops.json           (200KB)
  │   ├── trips.json           (500KB)
  │   └── stop_times_index.json (optimized, ~2MB)
```

### 2. **KV (Key-Value) Storage**
**Purpose**: Cache frequently accessed data
- ✅ Free: 100,000 reads/day
- ✅ Free: 1,000 writes/day
- ✅ Free: 1GB storage
- ⚠️ Eventual consistency (60 seconds)

**Strategy**:
```javascript
// Cache parsed routes, stops, and recent queries
KV Keys:
  - gtfs:routes:latest
  - gtfs:stops:latest
  - cache:route:25:stop:1234 (cached departures)
```

### 3. **Durable Objects** (Advanced)
**Purpose**: Maintain state and handle heavy processing
- ✅ Free: 1 million requests/month
- ✅ Free: 400,000 GB-seconds/month
- ⚠️ More complex to implement

**Strategy**:
- Use DO to download and parse GTFS once
- Keep parsed data in DO's persistent state
- Workers query the DO instead of parsing themselves

### 4. **Cron Triggers**
**Purpose**: Pre-process GTFS data periodically
- ✅ Free: Unlimited scheduled tasks
- ✅ No request limits for Cron

**Strategy**:
```javascript
// Schedule: Every 6 hours
1. Download GTFS ZIP
2. Parse all files
3. Store in R2/KV
4. Workers read from R2/KV (fast!)
```

### 5. **Workers Analytics Engine**
**Purpose**: Track usage and performance
- ✅ Free tier available
- Monitor which endpoints are slow
- Track error rates

## Recommended Architecture (Free Tier Optimized)

### Option A: R2 + Cron (Best for Free Tier)
```
┌─────────────────┐
│  Cron Trigger   │ (Every 6 hours)
│  (Free)         │
└────────┬────────┘
         │
         ├─→ Download GTFS
         ├─→ Parse files
         ├─→ Store in R2
         │
┌────────▼────────┐
│   R2 Storage    │
│   (Pre-parsed)  │
└────────┬────────┘
         │
┌────────▼────────┐
│  Worker API     │ (Reads from R2, <10ms)
│  (Your API)     │
└─────────────────┘
```

**Pros**:
- ✅ API responses <5ms
- ✅ No CPU limit issues
- ✅ Fresh data every 6 hours
- ✅ All free tier

**Cons**:
- Need to set up R2 bucket
- Slightly more complex setup

### Option B: KV + Cron (Simple)
```
┌─────────────────┐
│  Cron Trigger   │ (Every 6 hours)
└────────┬────────┘
         │
         ├─→ Download GTFS
         ├─→ Parse & store in KV
         │
┌────────▼────────┐
│   KV Storage    │
└────────┬────────┘
         │
┌────────▼────────┐
│  Worker API     │ (Reads from KV, <2ms)
└─────────────────┘
```

**Pros**:
- ✅ Very fast reads (<2ms)
- ✅ Simple to implement
- ✅ All free tier

**Cons**:
- ⚠️ 1GB limit (may not fit all GTFS data)
- ⚠️ 1,000 writes/day limit

### Option C: Hybrid (Production Ready)
```
┌─────────────────┐
│  Cron Trigger   │
└────────┬────────┘
         │
         ├─→ Download GTFS
         ├─→ Parse files
         ├─→ Store raw in R2
         ├─→ Cache hot data in KV
         │
┌────────▼────────┐     ┌─────────────┐
│   R2 Storage    │     │ KV Storage  │
│  (Full data)    │     │ (Hot cache) │
└────────┬────────┘     └──────┬──────┘
         │                     │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │    Worker API       │
         │  1. Check KV first  │
         │  2. Fall back to R2 │
         └─────────────────────┘
```

**Pros**:
- ✅ Ultra-fast common queries (KV)
- ✅ Complete data available (R2)
- ✅ Most reliable

## Implementation Priority

### Phase 1: Quick Win (Today)
1. Keep current code (already optimized)
2. Deploy to Cloudflare Workers
3. Monitor performance

### Phase 2: Add KV Cache (Tomorrow)
1. Create KV namespace
2. Cache routes & stops in KV
3. Cache recent queries for 1 hour

### Phase 3: Add R2 Storage (This Week)
1. Create R2 bucket
2. Create Cron Trigger worker
3. Pre-process GTFS data
4. Update API to read from R2

### Phase 4: Production Optimization (Next Week)
1. Add hybrid caching (KV + R2)
2. Add analytics
3. Add error monitoring

## Cost Estimate (Beyond Free Tier)

If you exceed free limits:

| Service | Free Tier | Paid (if needed) |
|---------|-----------|------------------|
| Workers | 100k req/day | $5/10M requests |
| R2 | 10GB | $0.015/GB/month |
| KV | 100k reads/day | $0.50/10M reads |
| Cron | Unlimited | Free |

**Realistic cost for 1M requests/day**: ~$5-10/month

## Next Steps

Would you like me to:
1. ✅ Implement KV caching (easiest, immediate benefit)
2. ✅ Create R2 + Cron worker setup (best long-term)
3. ✅ Set up monitoring/analytics
4. ✅ All of the above

Choose option and I'll implement it!
