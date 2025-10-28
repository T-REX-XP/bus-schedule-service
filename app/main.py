from fastapi import FastAPI, Query, HTTPException
from datetime import datetime
from gtfs_utils import download_gtfs_zip, get_upcoming_departures, get_cached_zip

# GTFS feed URL for EMT Valencia (official open data portal)
# Updated URL from: https://opendata.vlci.valencia.es/dataset/google-transit-lines-stops-bus-schedules
GTFS_URL = (
    "https://opendata.vlci.valencia.es/dataset/google-transit-lines-stops-bus-schedules/"
    "resource/c81b69e6-c082-44dc-acc6-66fc417b4e66/download/google_transit.zip"
)

# -----------------------------
# API definition with Swagger
# -----------------------------
app = FastAPI(
    title="🚍 EMT Valencia Bus Schedule API",
    description=(
        "Public microservice providing upcoming bus departures for EMT Valencia "
        "based on GTFS open data. Data is fetched from "
        "[opendata.vlci.valencia.es](https://opendata.vlci.valencia.es/)."
    ),
    version="1.0.0",
    contact={
        "name": "Valencia Bus API Demo",
        "url": "https://opendata.vlci.valencia.es/",
        "email": "support@example.com",
    },
    license_info={
        "name": "CC-BY 4.0",
        "url": "https://creativecommons.org/licenses/by/4.0/",
    },
)

@app.get(
    "/",
    tags=["Health"],
    summary="API Status",
    description="Check if the API is running and get basic information."
)
def root():
    """Return API status and available endpoints."""
    return {
        "status": "running",
        "service": "EMT Valencia Bus Schedule API",
        "version": "1.0.0",
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "find_stop": "/find-stop?name={stop_name}",
            "find_route": "/find-route?name={route_name}",
            "stops": "/stops?q={search_term}",
            "routes": "/routes?q={search_term}",
            "departures": "/departures?route_id={route_id}&stop_id={stop_id}&limit={limit}",
            "gtfs_status": "/gtfs-status"
        }
    }

@app.get(
    "/gtfs-status",
    tags=["Health"],
    summary="GTFS Data Source Status",
    description="Check if the GTFS data source is accessible."
)
def gtfs_status():
    """Check if the GTFS data source is available."""
    import requests
    try:
        resp = requests.head(GTFS_URL, timeout=10)
        if resp.status_code == 200:
            return {
                "status": "available",
                "url": GTFS_URL,
                "message": "GTFS data source is accessible"
            }
        else:
            return {
                "status": "unavailable",
                "url": GTFS_URL,
                "status_code": resp.status_code,
                "message": f"GTFS data source returned status code {resp.status_code}. Please verify the URL at https://opendata.vlci.valencia.es/"
            }
    except Exception as e:
        return {
            "status": "error",
            "url": GTFS_URL,
            "error": str(e),
            "message": "Failed to connect to GTFS data source. Please check the URL at https://opendata.vlci.valencia.es/"
        }

@app.get(
    "/find-stop",
    tags=["Stops"],
    summary="Find stop ID by name or location",
    description=(
        "Search for bus stops by name or find stops near a specific location.\n\n"
        "**Search by name:**\n"
        "- `/find-stop?name=plaza ayuntamiento`\n\n"
        "**Search near location:**\n"
        "- `/find-stop?lat=39.4699&lon=-0.3763&radius=500` (radius in meters, default: 500m)\n\n"
        "**Combine both:**\n"
        "- `/find-stop?name=plaza&lat=39.4699&lon=-0.3763`\n\n"
        "Returns stops with their IDs, names, and distances (if location provided)."
    ),
)
def find_stop(
    name: str = Query(None, description="Search term to filter stops by name (case-insensitive)"),
    lat: float = Query(None, description="Latitude for location-based search (e.g., 39.4699)", ge=-90, le=90),
    lon: float = Query(None, description="Longitude for location-based search (e.g., -0.3763)", ge=-180, le=180),
    radius: int = Query(500, description="Search radius in meters (default: 500m)", ge=50, le=5000),
    limit: int = Query(10, description="Maximum number of results to return", ge=1, le=100),
):
    """Find stop IDs by searching stop names or by proximity to a location."""
    try:
        from gtfs_utils import parse_csv_from_zip
        from math import radians, sin, cos, sqrt, atan2
        
        z = get_cached_zip(GTFS_URL)
        stops = parse_csv_from_zip(z, "stops.txt")
        
        # Filter by name if provided
        if name:
            stops = [s for s in stops if name.lower() in s["stop_name"].lower()]
        
        # Calculate distances if location provided
        if lat is not None and lon is not None:
            def haversine_distance(lat1, lon1, lat2, lon2):
                """Calculate distance between two points in meters using Haversine formula."""
                R = 6371000  # Earth radius in meters
                lat1_rad, lon1_rad = radians(lat1), radians(lon1)
                lat2_rad, lon2_rad = radians(lat2), radians(lon2)
                
                dlat = lat2_rad - lat1_rad
                dlon = lon2_rad - lon1_rad
                
                a = sin(dlat/2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon/2)**2
                c = 2 * atan2(sqrt(a), sqrt(1-a))
                return R * c
            
            # Add distance to each stop
            for stop in stops:
                stop_lat = float(stop["stop_lat"])
                stop_lon = float(stop["stop_lon"])
                distance = haversine_distance(lat, lon, stop_lat, stop_lon)
                stop["distance_meters"] = round(distance, 1)
            
            # Filter by radius
            stops = [s for s in stops if s["distance_meters"] <= radius]
            
            # Sort by distance
            stops.sort(key=lambda s: s["distance_meters"])
        else:
            # Sort by name if no location provided
            stops.sort(key=lambda s: s["stop_name"])
        
        # Limit results
        stops = stops[:limit]
        
        if not stops:
            search_info = []
            if name:
                search_info.append(f"name containing '{name}'")
            if lat is not None and lon is not None:
                search_info.append(f"within {radius}m of ({lat}, {lon})")
            
            return {
                "count": 0,
                "message": f"No stops found {' and '.join(search_info) if search_info else ''}",
                "search_criteria": {
                    "name": name,
                    "location": {"lat": lat, "lon": lon} if lat is not None and lon is not None else None,
                    "radius_meters": radius if lat is not None and lon is not None else None
                },
                "stops": []
            }
        
        # Format response
        result_stops = []
        for s in stops:
            stop_info = {
                "stop_id": s["stop_id"],
                "name": s["stop_name"],
                "location": {
                    "lat": float(s["stop_lat"]),
                    "lon": float(s["stop_lon"])
                }
            }
            if "distance_meters" in s:
                stop_info["distance_meters"] = s["distance_meters"]
            result_stops.append(stop_info)
        
        return {
            "count": len(result_stops),
            "search_criteria": {
                "name": name,
                "location": {"lat": lat, "lon": lon} if lat is not None and lon is not None else None,
                "radius_meters": radius if lat is not None and lon is not None else None
            },
            "stops": result_stops
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Service unavailable: {str(e)}. The GTFS data source may be temporarily unavailable or the URL may need to be updated."
        )

@app.get(
    "/routes",
    tags=["Routes"],
    summary="List all bus routes",
    description=(
        "Returns a list of all bus routes in the GTFS feed.\n\n"
        "Optionally filter routes by route number, short name, or long name using the `q` parameter.\n\n"
        "Example: `/routes?q=25` to find route 25 or routes containing '25' in their name"
    ),
)
def list_routes(q: str = Query("", description="Filter routes by route ID, short name, or long name (case-insensitive)")):
    """Return a list of all bus routes, optionally filtered."""
    try:
        from gtfs_utils import parse_csv_from_zip
        z = get_cached_zip(GTFS_URL)
        routes = parse_csv_from_zip(z, "routes.txt")
        
        if q:
            routes = [r for r in routes if 
                     q.lower() in r.get("route_id", "").lower() or
                     q.lower() in r.get("route_short_name", "").lower() or
                     q.lower() in r.get("route_long_name", "").lower()]
        
        # Sort by route_short_name (numeric if possible)
        def sort_key(route):
            short_name = route.get("route_short_name", "")
            try:
                return (0, int(short_name))  # Numeric routes first
            except ValueError:
                return (1, short_name)  # Then alphabetic
        
        routes.sort(key=sort_key)
        
        return {
            "count": len(routes),
            "filter": q if q else None,
            "routes": [
                {
                    "route_id": r.get("route_id", ""),
                    "route_short_name": r.get("route_short_name", ""),
                    "route_long_name": r.get("route_long_name", ""),
                    "route_type": r.get("route_type", ""),
                    "route_color": r.get("route_color", ""),
                    "route_text_color": r.get("route_text_color", "")
                } for r in routes
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Service unavailable: {str(e)}. The GTFS data source may be temporarily unavailable or the URL may need to be updated."
        )

@app.get(
    "/find-route",
    tags=["Routes"],
    summary="Find route by number or name",
    description=(
        "Search for bus routes by route number, short name, or long name.\n\n"
        "**Examples:**\n"
        "- `/find-route?number=25` - Find route 25\n"
        "- `/find-route?name=centro` - Find routes with 'centro' in the name\n"
        "- `/find-route?number=25&include_stops=true` - Get route 25 with all its stops\n\n"
        "Returns detailed route information including stops if requested."
    ),
)
def find_route(
    number: str = Query(None, description="Route number or short name (e.g., '25', 'N1')"),
    name: str = Query(None, description="Search term to filter routes by long name (case-insensitive)"),
    include_stops: bool = Query(False, description="Include list of stops served by the route"),
    limit: int = Query(10, description="Maximum number of results to return", ge=1, le=100),
):
    """Find routes by number or name, optionally with their stops."""
    try:
        from gtfs_utils import parse_csv_from_zip
        z = get_cached_zip(GTFS_URL)
        routes = parse_csv_from_zip(z, "routes.txt")
        
        # Filter by number (route_id or route_short_name)
        if number:
            routes = [r for r in routes if 
                     number.lower() == r.get("route_id", "").lower() or
                     number.lower() == r.get("route_short_name", "").lower() or
                     number.lower() in r.get("route_id", "").lower() or
                     number.lower() in r.get("route_short_name", "").lower()]
        
        # Filter by name (route_long_name)
        if name:
            routes = [r for r in routes if name.lower() in r.get("route_long_name", "").lower()]
        
        if not routes:
            return {
                "count": 0,
                "message": f"No routes found matching the search criteria",
                "search_criteria": {
                    "number": number,
                    "name": name
                },
                "routes": []
            }
        
        # Sort by route_short_name
        def sort_key(route):
            short_name = route.get("route_short_name", "")
            try:
                return (0, int(short_name))
            except ValueError:
                return (1, short_name)
        
        routes.sort(key=sort_key)
        routes = routes[:limit]
        
        # Get stops for each route if requested
        result_routes = []
        for r in routes:
            route_info = {
                "route_id": r.get("route_id", ""),
                "route_short_name": r.get("route_short_name", ""),
                "route_long_name": r.get("route_long_name", ""),
                "route_type": r.get("route_type", ""),
                "route_color": r.get("route_color", ""),
                "route_text_color": r.get("route_text_color", "")
            }
            
            if include_stops:
                # Get trips for this route
                trips = parse_csv_from_zip(z, "trips.txt")
                route_trips = [t for t in trips if t.get("route_id") == r.get("route_id")]
                
                if route_trips:
                    # Get stop times for the first trip (representative)
                    trip_id = route_trips[0].get("trip_id")
                    stop_times = parse_csv_from_zip(z, "stop_times.txt")
                    trip_stops = [st for st in stop_times if st.get("trip_id") == trip_id]
                    
                    # Sort by stop_sequence
                    trip_stops.sort(key=lambda st: int(st.get("stop_sequence", 0)))
                    
                    # Get stop details
                    stops = parse_csv_from_zip(z, "stops.txt")
                    stops_dict = {s.get("stop_id"): s for s in stops}
                    
                    route_info["stops"] = [
                        {
                            "stop_sequence": int(st.get("stop_sequence", 0)),
                            "stop_id": st.get("stop_id", ""),
                            "stop_name": stops_dict.get(st.get("stop_id"), {}).get("stop_name", ""),
                            "arrival_time": st.get("arrival_time", ""),
                            "departure_time": st.get("departure_time", "")
                        } for st in trip_stops if st.get("stop_id") in stops_dict
                    ]
                    route_info["total_stops"] = len(route_info["stops"])
                else:
                    route_info["stops"] = []
                    route_info["total_stops"] = 0
            
            result_routes.append(route_info)
        
        return {
            "count": len(result_routes),
            "search_criteria": {
                "number": number,
                "name": name,
                "include_stops": include_stops
            },
            "routes": result_routes
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Service unavailable: {str(e)}. The GTFS data source may be temporarily unavailable or the URL may need to be updated."
        )

@app.get(
    "/stops",
    tags=["Stops"],
    summary="List all bus stops",
    description=(
        "Returns a list of all bus stops in the GTFS feed.\n\n"
        "Optionally filter stops by name using the `q` parameter.\n\n"
        "Example: `/stops?q=plaza` to find all stops containing 'plaza' in their name"
    ),
)
def list_stops(q: str = Query("", description="Filter stops by name (case-insensitive)")):
    """Return a list of all bus stops, optionally filtered by name."""
    try:
        z = get_cached_zip(GTFS_URL)
        from gtfs_utils import parse_csv_from_zip
        stops = parse_csv_from_zip(z, "stops.txt")
        if q:
            stops = [s for s in stops if q.lower() in s["stop_name"].lower()]
        return {
            "count": len(stops),
            "filter": q if q else None,
            "stops": [
                {
                    "stop_id": s["stop_id"],
                    "name": s["stop_name"],
                    "lat": s["stop_lat"],
                    "lon": s["stop_lon"]
                } for s in stops
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Service unavailable: {str(e)}. The GTFS data source may be temporarily unavailable or the URL may need to be updated."
        )

@app.get(
    "/departures",
    tags=["Departures"],
    summary="Get upcoming departures",
    description=(
        "Returns the next scheduled departures for a specific route and stop ID.\n\n"
        "Example: `/departures?route_id=25&stop_id=1234&limit=5`"
    ),
)
def departures(
    route_id: str = Query(..., description="Route ID (e.g., '25')"),
    stop_id: str = Query(..., description="Stop ID (e.g., '1234')"),
    limit: int = Query(5, ge=1, le=50, description="Number of upcoming departures to return"),
):
    """Return upcoming departures for a given route and stop."""
    try:
        z = get_cached_zip(GTFS_URL)
        now = datetime.now()
        results = get_upcoming_departures(route_id, stop_id, now, z)
        
        if not results:
            return {
                "message": f"No upcoming departures found for route {route_id} at stop {stop_id}",
                "departures": []
            }
        
        return {
            "route_id": route_id,
            "stop_id": stop_id,
            "departures": [
                {
                    "departure_time": dep_time.strftime("%H:%M:%S"),
                    "trip_id": st["trip_id"],
                    "stop_sequence": st["stop_sequence"],
                }
                for dep_time, st in results[:limit]
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Service unavailable: {str(e)}. The GTFS data source may be temporarily unavailable or the URL may need to be updated."
        )
