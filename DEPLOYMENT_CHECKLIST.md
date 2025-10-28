# 🚀 Deployment Checklist

## Pre-Deployment

- [ ] **Wrangler Authentication**
  ```powershell
  npx wrangler whoami
  # If not logged in: npx wrangler login
  ```

- [ ] **Review Configuration**
  - [ ] Check `wrangler.toml` settings
  - [ ] Verify GTFS_URL is correct
  - [ ] Confirm KV namespace ID is set

- [ ] **Test Locally (Docker)**
  ```powershell
  docker-compose up
  # Test: http://localhost:8787/docs
  ```

## Deployment

- [ ] **Run Deployment**
  ```powershell
  npm run deploy
  # This automatically runs setup script first
  ```

- [ ] **Verify KV Namespace**
  ```powershell
  npx wrangler kv:namespace list
  # Should show: GTFS_CACHE namespace
  ```

## Post-Deployment

- [ ] **Test Deployed Worker**
  ```powershell
  # Get worker URL from deployment output
  $WORKER_URL = "https://emt-valencia-bus-api.YOURNAME.workers.dev"
  
  # Test endpoints
  Invoke-RestMethod "$WORKER_URL/"
  Invoke-RestMethod "$WORKER_URL/routes"
  Invoke-RestMethod "$WORKER_URL/stops"
  ```

- [ ] **Check Logs**
  ```powershell
  npx wrangler tail
  # Look for: "KV cache hit" or "KV cache miss"
  ```

- [ ] **Warm Up Cache (First Deployment)**
  ```powershell
  # First requests will be slow (cold start)
  Invoke-RestMethod "$WORKER_URL/routes" | Out-Null
  Invoke-RestMethod "$WORKER_URL/stops" | Out-Null
  
  # Second requests should be fast (cached)
  Measure-Command { Invoke-RestMethod "$WORKER_URL/routes" }
  # Should see < 1 second
  ```

- [ ] **Monitor Cloudflare Dashboard**
  - Go to: https://dash.cloudflare.com
  - Navigate to: Workers & Pages → emt-valencia-bus-api
  - Check:
    - [ ] CPU time < 2ms per request
    - [ ] No errors in logs
    - [ ] Requests being served successfully

- [ ] **Monitor KV Usage**
  - Navigate to: Workers & Pages → KV
  - Select: GTFS_CACHE namespace
  - Check:
    - [ ] Keys created (gtfs:routes, gtfs:stops, gtfs:trips)
    - [ ] Read operations increasing
    - [ ] Storage usage ~1-2MB

## Troubleshooting

### Issue: "KV namespace not found"
```powershell
# Run setup manually
npm run setup
# Or create manually
npx wrangler kv:namespace create "GTFS_CACHE"
```

### Issue: High CPU time (>10ms)
```powershell
# Check if cache is being used
npx wrangler tail
# Look for "KV cache hit" messages

# Check KV keys
npx wrangler kv:key list --binding GTFS_CACHE
# Should show 3 keys: routes, stops, trips
```

### Issue: Slow responses
```powershell
# First request after deployment is always slow (cold start)
# Subsequent requests should be fast

# Warm up cache:
Invoke-RestMethod "$WORKER_URL/routes"
Invoke-RestMethod "$WORKER_URL/stops"

# Test again:
Measure-Command { Invoke-RestMethod "$WORKER_URL/routes" }
```

### Issue: Cache not updating
```powershell
# Clear cache manually
npx wrangler kv:key list --binding GTFS_CACHE | ForEach-Object {
  npx wrangler kv:key delete $_.name --binding GTFS_CACHE
}

# Next request will repopulate cache
```

## Expected Results

### ✅ Successful Deployment

```
✔ Built successfully!
✔ Uploaded to Cloudflare
✔ Published to https://emt-valencia-bus-api.YOURNAME.workers.dev

CPU Time: 0.5-2ms per request (after cache warmup)
Memory: 1-5MB
Cache Hit Ratio: 95%+
```

### ✅ Healthy KV Usage

```
KV Namespace: GTFS_CACHE
Keys: 3 (routes, stops, trips)
Storage: ~2MB
Reads/day: ~30,000 (with 10,000 requests/day)
Writes/day: ~4-8 (cache refreshes)
```

### ✅ Performance Metrics

| Metric | Target | Your Result |
|--------|--------|-------------|
| CPU Time | < 2ms | _______ ms |
| Memory | < 10MB | _______ MB |
| Response Time | < 500ms | _______ ms |
| Cache Hit Rate | > 95% | _______ % |

## Next Steps After Deployment

1. **Share your API URL!** 🎉
   ```
   https://emt-valencia-bus-api.YOURNAME.workers.dev/docs
   ```

2. **Set up custom domain** (optional)
   - Go to: Workers & Pages → emt-valencia-bus-api → Settings → Domains
   - Add custom domain: `api.yourdomain.com`

3. **Add monitoring** (optional)
   - Set up alerts in Cloudflare Dashboard
   - Monitor CPU time and error rates

4. **Consider R2 + Cron** (future optimization)
   - Pre-process GTFS data with Cron Trigger
   - Store in R2 for even faster access
   - See: `CLOUDFLARE_OPTIMIZATION.md`

---

**Happy Deploying! 🚀**

For questions or issues, check:
- `KV_INTEGRATION_GUIDE.md` - KV caching details
- `CLOUDFLARE_SETUP.md` - Detailed setup instructions
- `CLOUDFLARE_OPTIMIZATION.md` - Advanced optimization strategies
