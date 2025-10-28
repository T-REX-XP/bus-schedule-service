"""
Cloudflare Workers entry point for EMT Valencia Bus API
This adapter makes the FastAPI application compatible with Cloudflare Workers.
"""

from js import Response, Headers, fetch
import json
import sys
import os

# Add app directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

from main import app
from fastapi.responses import JSONResponse

async def on_fetch(request):
    """
    Cloudflare Workers fetch handler.
    Adapts incoming Workers requests to FastAPI and returns Workers-compatible responses.
    """
    try:
        # Extract request details
        url = request.url
        method = request.method
        headers_dict = {}
        
        # Convert Workers headers to dict
        if hasattr(request, 'headers'):
            for key in request.headers.keys():
                headers_dict[key.lower()] = request.headers.get(key)
        
        # Get request body if present
        body = None
        if method in ['POST', 'PUT', 'PATCH']:
            try:
                body = await request.text()
            except:
                body = None
        
        # Create ASGI scope
        from urllib.parse import urlparse, parse_qs
        parsed_url = urlparse(url)
        
        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
            "scheme": parsed_url.scheme,
            "path": parsed_url.path,
            "query_string": parsed_url.query.encode() if parsed_url.query else b"",
            "root_path": "",
            "headers": [[k.encode(), v.encode()] for k, v in headers_dict.items()],
            "server": (parsed_url.hostname, parsed_url.port or (443 if parsed_url.scheme == "https" else 80)),
        }
        
        # Prepare to receive response
        response_started = False
        status_code = 200
        response_headers = []
        response_body = []
        
        async def receive():
            return {
                "type": "http.request",
                "body": body.encode() if body else b"",
                "more_body": False,
            }
        
        async def send(message):
            nonlocal response_started, status_code, response_headers, response_body
            
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                response_headers = message.get("headers", [])
            elif message["type"] == "http.response.body":
                response_body.append(message.get("body", b""))
        
        # Call FastAPI app
        await app(scope, receive, send)
        
        # Build Workers response
        body_bytes = b"".join(response_body)
        
        # Create response headers
        headers_obj = Headers.new()
        for header_name, header_value in response_headers:
            headers_obj.set(header_name.decode(), header_value.decode())
        
        # Return Workers Response
        return Response.new(body_bytes, status=status_code, headers=headers_obj)
        
    except Exception as e:
        # Error handling
        error_response = {
            "error": "Internal Server Error",
            "message": str(e),
            "type": type(e).__name__
        }
        
        headers_obj = Headers.new()
        headers_obj.set("Content-Type", "application/json")
        
        return Response.new(
            json.dumps(error_response),
            status=500,
            headers=headers_obj
        )
