import requests, zipfile, io, csv, time
from datetime import datetime, timedelta

_cache = {"data": None, "timestamp": 0}
CACHE_TTL = 3600 * 6  # 6 hours

def download_gtfs_zip(url: str) -> zipfile.ZipFile:
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return zipfile.ZipFile(io.BytesIO(resp.content))
    except requests.exceptions.HTTPError as e:
        raise Exception(f"Failed to download GTFS data: {e}. Please check if the URL is correct and accessible.") from e
    except Exception as e:
        raise Exception(f"Error downloading GTFS data: {e}") from e

def get_cached_zip(url: str) -> zipfile.ZipFile:
    now = time.time()
    if _cache["data"] and now - _cache["timestamp"] < CACHE_TTL:
        return _cache["data"]
    z = download_gtfs_zip(url)
    _cache.update({"data": z, "timestamp": now})
    return z

def parse_csv_from_zip(z: zipfile.ZipFile, filename: str):
    with z.open(filename) as f:
        text = io.TextIOWrapper(f, encoding="utf-8")
        reader = csv.DictReader(text)
        return list(reader)

def parse_gtfs_time(time_str: str, base_date: datetime) -> datetime:
    """
    Parse GTFS time format which can have hours >= 24 for times after midnight.
    For example, '24:35:00' means 00:35:00 the next day.
    
    Args:
        time_str: Time string in format "HH:MM:SS"
        base_date: The base date to calculate from
    
    Returns:
        datetime object representing the actual time
    """
    hours, minutes, seconds = map(int, time_str.split(':'))
    
    # Calculate extra days if hours >= 24
    extra_days = hours // 24
    hours = hours % 24
    
    # Create time with normalized hours
    departure_time = datetime.combine(
        base_date.date(),
        datetime.min.time().replace(hour=hours, minute=minutes, second=seconds)
    )
    
    # Add extra days if needed
    if extra_days > 0:
        departure_time += timedelta(days=extra_days)
    
    return departure_time

def get_upcoming_departures(route_id: str, stop_id: str, after_time: datetime, gtfs_zip: zipfile.ZipFile):
    stop_times = parse_csv_from_zip(gtfs_zip, "stop_times.txt")
    trips = parse_csv_from_zip(gtfs_zip, "trips.txt")

    trip_ids_for_route = {t["trip_id"] for t in trips if t["route_id"] == route_id}

    upcoming = []
    for st in stop_times:
        if st["trip_id"] in trip_ids_for_route and st["stop_id"] == stop_id:
            # Use the new parse_gtfs_time function to handle times >= 24:00:00
            departure_time = parse_gtfs_time(st["departure_time"], after_time)
            
            # If the departure time is in the past, it might be for the next service day
            if departure_time < after_time:
                departure_time += timedelta(days=1)
            
            upcoming.append((departure_time, st))
    upcoming.sort(key=lambda x: x[0])
    return upcoming
