# 🚍 EMT Valencia Bus Schedule API

A public microservice providing real-time bus schedule information for EMT Valencia (Spain) based on GTFS open data.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/T-REX-XP/bus-schedule-service)

## Features

- 🚏 **Find Bus Stops** - Search by name or location
- 🚌 **Find Routes** - Search routes by number or name
- ⏰ **Real-time Departures** - Get upcoming bus departure times
- 🌍 **Location-based Search** - Find nearest stops using GPS coordinates
- 📊 **Interactive API Docs** - Swagger UI and ReDoc
- 🔄 **Auto-caching** - 6-hour GTFS data cache
- 🐳 **Docker Support** - Multi-stage optimized builds
- ☁️ **Cloudflare Workers** - Edge deployment ready

## Quick Start

### Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/bus-schedule-service.git
cd bus-schedule-service

# Start with Docker Compose
docker-compose up --build
```

Visit `http://localhost:8000/docs` for the interactive API documentation.

### Local Development

```bash
# Install dependencies
cd app
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### 🏥 Health & Status

- `GET /` - API status and available endpoints
- `GET /gtfs-status` - Check GTFS data source availability

### 🚏 Stops

- `GET /stops?q={search}` - List all stops (with optional filter)
- `GET /find-stop?name={name}` - Search stops by name
- `GET /find-stop?lat={lat}&lon={lon}&radius={meters}` - Find stops near location

### 🚌 Routes

- `GET /routes?q={search}` - List all routes (with optional filter)
- `GET /find-route?number={number}` - Find route by number
- `GET /find-route?number={number}&include_stops=true` - Get route with all stops

### ⏰ Departures

- `GET /departures?route_id={route}&stop_id={stop}&limit={n}` - Get upcoming departures

## Example Usage

### Find a Stop

```bash
# Search by name
curl "http://localhost:8000/find-stop?name=plaza%20ayuntamiento"

# Find nearest stops
curl "http://localhost:8000/find-stop?lat=39.4699&lon=-0.3763&radius=500"
```

### Find a Route

```bash
# Find route 25
curl "http://localhost:8000/find-route?number=25"

# Get route 25 with all stops
curl "http://localhost:8000/find-route?number=25&include_stops=true"
```

### Get Departures

```bash
# Get next 5 departures for route 25 at stop 1234
curl "http://localhost:8000/departures?route_id=25&stop_id=1234&limit=5"
```

## Deployment

### Docker

```bash
docker-compose up -d
```

### Cloudflare Workers

See [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md) for detailed instructions.

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler deploy
```

### Heroku / Railway / Render

The app works with any platform that supports Docker. Just point to the `Dockerfile`.

## Configuration

### Environment Variables

- `TZ` - Timezone (default: `Europe/Madrid`)
- `PYTHONUNBUFFERED` - Python output buffering (default: `1`)

### Docker Compose

Edit `docker-compose.yml`:

```yaml
environment:
  - TZ=Europe/Madrid
  - PYTHONUNBUFFERED=1
```

## Data Source

GTFS data from [Valencia Open Data Portal](https://opendata.vlci.valencia.es/)

- **Dataset**: Google Transit - EMT Valencia Bus Lines
- **Update Frequency**: Data is cached for 6 hours
- **License**: CC BY 4.0

## Technology Stack

- **FastAPI** - Modern Python web framework
- **Python 3.12** - Latest Python runtime
- **Docker** - Containerization
- **Cloudflare Workers** - Edge deployment (optional)
- **Uvicorn** - ASGI server

## Project Structure

```
bus-schedule-service/
├── app/
│   ├── main.py              # FastAPI application
│   ├── gtfs_utils.py        # GTFS data processing
│   └── requirements.txt     # Python dependencies
├── src/
│   └── worker.py            # Cloudflare Workers adapter
├── docker-compose.yml       # Docker Compose config
├── Dockerfile               # Multi-stage Docker build
├── wrangler.toml           # Cloudflare Workers config
└── README.md
```

## API Documentation

Once running, visit:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI JSON**: `http://localhost:8000/openapi.json`

## Performance

- **GTFS Cache**: 6-hour TTL reduces API calls
- **Multi-stage Docker**: ~50% smaller image size
- **Non-root Container**: Enhanced security
- **Health Checks**: Automatic container monitoring

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- EMT Valencia for providing public transportation data
- Valencia City Council for maintaining the open data portal
- GTFS community for the General Transit Feed Specification

## Support

- 📧 Email: support@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/bus-schedule-service/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/bus-schedule-service/discussions)

---

Made with ❤️ for Valencia 🍊
