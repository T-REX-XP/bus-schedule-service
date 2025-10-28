# Cloudflare Workers Setup Guide (Free Tier)

## Prerequisites
- Cloudflare account (free)
- Wrangler CLI installed: `npm install -g wrangler`
- Repository cloned

## Step 1: Login to Cloudflare
```bash
wrangler login
```

## Step 2: Create KV Namespace (Optional but Recommended)

KV storage will cache parsed GTFS data, reducing CPU time from ~10ms to <2ms.

```bash
# Create production KV namespace
wrangler kv:namespace create "GTFS_CACHE"

# Output example:
# 🌀 Creating namespace with title "emt-valencia-bus-api-GTFS_CACHE"
# ✨ Success!
# Add the following to your wrangler.toml:
# [[kv_namespaces]]
# binding = "GTFS_CACHE"
# id = "abc123def456..."

# Create preview KV namespace (for testing)
wrangler kv:namespace create "GTFS_CACHE" --preview

# Output example:
# 🌀 Creating namespace with title "emt-valencia-bus-api-GTFS_CACHE_preview"
# ✨ Success!
# preview_id = "xyz789abc123..."
```

## Step 3: Update wrangler.toml

Add the KV namespace IDs to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "GTFS_CACHE"
id = "abc123def456..."           # from step 2 (production)
preview_id = "xyz789abc123..."   # from step 2 (preview)
```

## Step 4: Deploy to Cloudflare

```bash
# Deploy to production
npm run deploy

# Or with wrangler directly
wrangler deploy

# Output:
# Total Upload: xx.xx KiB / gzip: xx.xx KiB
# Uploaded emt-valencia-bus-api (x.xx sec)
# Published emt-valencia-bus-api (x.xx sec)
#   https://emt-valencia-bus-api.your-subdomain.workers.dev
```

## Step 5: Test Your Deployment

```bash
# Get your worker URL from the deploy output, then test:
curl https://emt-valencia-bus-api.your-subdomain.workers.dev/

# Test routes
curl https://emt-valencia-bus-api.your-subdomain.workers.dev/routes?q=25

# Test stops
curl https://emt-valencia-bus-api.your-subdomain.workers.dev/stops?q=plaza

# Test departures
curl "https://emt-valencia-bus-api.your-subdomain.workers.dev/departures?route_id=25&stop_id=1234&limit=5"

# View documentation
curl https://emt-valencia-bus-api.your-subdomain.workers.dev/docs
```

## Step 6: Monitor Usage (Optional)

```bash
# View logs in real-time
wrangler tail

# View deployment info
wrangler deployments list
```

## Optional: Create R2 Bucket for Pre-processed Data

R2 storage allows you to store pre-processed GTFS data, eliminating download/parse time.

```bash
# Create R2 bucket
wrangler r2 bucket create gtfs-data

# Add to wrangler.toml:
# [[r2_buckets]]
# binding = "GTFS_DATA"
# bucket_name = "gtfs-data"
```

## Optional: Set up Cron Trigger

Cron triggers can pre-process GTFS data periodically (recommended for production).

Add to `wrangler.toml`:
```toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

Create a cron handler in your worker to download and cache GTFS data.

## Troubleshooting

### Error: "Worker exceeded resource limits"
**Solution**: Enable KV caching (Step 2-3) or use R2 storage

### Error: "KV namespace not found"
**Solution**: Make sure you've created the KV namespace and added IDs to wrangler.toml

### Error: "Authentication error"
**Solution**: Run `wrangler login` again

### Slow first request
**Normal behavior**: First request downloads GTFS data. Subsequent requests use cache.
**Solution**: Implement KV caching or R2 pre-processing

## Free Tier Limits

| Resource | Free Tier | Your Usage (Estimated) |
|----------|-----------|------------------------|
| Requests | 100,000/day | ~1,000-10,000/day |
| CPU Time | 10ms/request | 2-5ms with KV cache |
| KV Reads | 100,000/day | ~1,000-10,000/day |
| KV Writes | 1,000/day | ~4/day (every 6h update) |
| R2 Storage | 10GB | ~0.1GB |

**You should be well within free tier limits!**

## Production Checklist

- [ ] KV namespace created and configured
- [ ] Deployed successfully
- [ ] Tested all endpoints
- [ ] Documentation accessible at `/docs`
- [ ] Set up custom domain (optional)
- [ ] Monitor with Wrangler Analytics
- [ ] Consider R2 + Cron for production (optional)

## Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker
3. Click "Triggers" → "Custom Domains"
4. Add your domain (e.g., api.yourdomain.com)

## Next Steps

- Enable analytics: `wrangler analytics`
- Set up alerts for errors
- Consider upgrading to paid plan for higher limits
- Implement rate limiting if needed

## Support

- Cloudflare Docs: https://developers.cloudflare.com/workers/
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler/
- Discord: https://discord.gg/cloudflaredev
