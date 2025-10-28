# 🎯 Quick Reference

## Most Common Commands

### 🚀 Deployment
```powershell
# Full deployment (recommended)
npm run deploy

# Manual steps
npm run setup          # Configure KV namespaces
npx wrangler deploy    # Deploy to Cloudflare
```

### 🐳 Docker Development
```powershell
# Start Docker container
docker-compose up

# Rebuild after code changes
docker-compose up --build

# Stop container
docker-compose down

# View logs
docker-compose logs -f
```

### 🔧 Local Development
```powershell
# Run with Wrangler (preview mode)
npm run dev

# Run with Node.js server (Docker alternative)
npm start
```

### 📊 Monitoring
```powershell
# Watch live logs
npx wrangler tail

# Check authentication
npx wrangler whoami

# View KV keys
npx wrangler kv:key list --binding GTFS_CACHE

# Get specific cache entry
npx wrangler kv:key get "gtfs:routes:abc123" --binding GTFS_CACHE
```

### 🧹 Cache Management
```powershell
# Delete specific cache key
npx wrangler kv:key delete "gtfs:routes:abc123" --binding GTFS_CACHE

# Clear all cache (force refresh)
npx wrangler kv:key list --binding GTFS_CACHE | ForEach-Object {
  npx wrangler kv:key delete $_.name --binding GTFS_CACHE
}
```

### 🔍 Testing
```powershell
# Test local Docker
Invoke-RestMethod http://localhost:8787/routes

# Test deployed worker
$WORKER_URL = "https://emt-valencia-bus-api.YOURNAME.workers.dev"
Invoke-RestMethod "$WORKER_URL/routes"

# Measure response time
Measure-Command { Invoke-RestMethod "$WORKER_URL/routes" }
```

### 📚 API Endpoints

| Endpoint | Description | Example |
|----------|-------------|---------|
| `/` | API info | `GET /` |
| `/docs` | Swagger UI | `GET /docs` |
| `/routes` | List routes | `GET /routes?q=35` |
| `/stops` | List stops | `GET /stops?q=hospital` |
| `/find-stop` | Find by location | `GET /find-stop?lat=39.47&lon=-0.37&radius=500` |
| `/find-route` | Find route details | `GET /find-route?number=35&include_stops=true` |
| `/departures` | Upcoming departures | `GET /departures?route_id=035&stop_id=1234` |
| `/gtfs-status` | Check GTFS source | `GET /gtfs-status` |

### 🔑 Environment Variables

**Cloudflare Workers** (`wrangler.toml`):
```toml
[vars]
GTFS_URL = "https://opendata.vlci.valencia.es/..."
TZ = "Europe/Madrid"
```

**Docker** (`.env` file):
```env
GTFS_URL=https://opendata.vlci.valencia.es/...
TZ=Europe/Madrid
PORT=8787
```

### 📁 Project Structure

```
bus-schedule-service/
├── src/
│   ├── index.js          # Worker entry point + handlers
│   ├── gtfs-utils.js     # GTFS parsing utilities
│   ├── kv-cache.js       # KV caching layer ⭐
│   ├── openapi.js        # API specification
│   ├── swagger-ui.js     # Documentation UI
│   └── server.js         # Docker Node.js server
├── scripts/
│   ├── setup-cloudflare.mjs  # Auto KV setup (cross-platform)
│   └── setup-cloudflare.ps1  # Auto KV setup (PowerShell)
├── wrangler.toml         # Cloudflare config + KV binding
├── package.json          # Dependencies + scripts
├── Dockerfile            # Docker build
├── docker-compose.yml    # Docker orchestration
└── .env.example          # Environment template
```

### 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "KV namespace not found" | Run `npm run setup` |
| High CPU time (>10ms) | Cache is warming up, wait 1-2 minutes |
| Slow responses | First request is cold start, try again |
| Cache not updating | Delete KV keys or wait 6 hours for expiry |
| Docker build fails | Run `npm install` and `docker-compose build` |
| Auth errors | Run `npx wrangler login` |

### 📖 Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Main documentation |
| `KV_INTEGRATION_GUIDE.md` | Complete KV caching guide ⭐ |
| `DEPLOYMENT_CHECKLIST.md` | Step-by-step deployment ⭐ |
| `CLOUDFLARE_SETUP.md` | Detailed Cloudflare setup |
| `CLOUDFLARE_OPTIMIZATION.md` | Advanced optimization strategies |
| `SERVICES_COMPARISON.md` | Cloudflare services comparison |
| `PERFORMANCE.md` | Performance optimization details |

### 🎯 Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| CPU Time | < 2ms | ✅ Achieved with KV |
| Memory | < 10MB | ✅ 1-5MB with filtering |
| Response Time | < 500ms | ✅ Cached responses |
| Cache Hit Rate | > 95% | ✅ After warmup |
| Free Tier Compliance | 10ms CPU limit | ✅ Well within limits |

### 🔗 Useful Links

- [Cloudflare Dashboard](https://dash.cloudflare.com)
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [GTFS Specification](https://gtfs.org/schedule/reference/)
- [EMT Valencia Open Data](https://www.emtvalencia.es/geoportal/)

---

**💡 Pro Tip:** Bookmark this file for quick reference during development!
