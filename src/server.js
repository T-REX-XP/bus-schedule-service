/**
 * Simple Node.js HTTP server for local Docker development
 * This mimics the Cloudflare Workers environment for testing
 */

import { createServer } from 'http';
import worker from './index.js';

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '0.0.0.0';

// Create environment object from process.env
const env = {
  GTFS_URL: process.env.GTFS_URL,
  TZ: process.env.TZ,
  // Mock KV namespace for local development (no-op)
  GTFS_CACHE: null, // KV is not available in local Docker, will fallback to parsing
};

const server = createServer(async (req, res) => {
  try {
    // Build the full URL
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || `${HOST}:${PORT}`;
    const url = `${protocol}://${host}${req.url}`;
    
    // Build headers object
    const headers = new Headers();
    Object.keys(req.headers).forEach(key => {
      const value = req.headers[key];
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    });
    
    // Get request body
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise((resolve) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
      });
    }
    
    // Create Request object
    const request = new Request(url, {
      method: req.method,
      headers: headers,
      body: body,
    });
    
    // Call the worker
    const response = await worker.fetch(request, env, {});
    
    // Set response status and headers
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    // Send response body
    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        pump();
      };
      await pump();
    } else {
      res.end();
    }
    
  } catch (error) {
    console.error('Server error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message,
    }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 GTFS URL: ${env.GTFS_URL ? env.GTFS_URL.substring(0, 50) + '...' : 'not set'}`);
  console.log(`⏰ Timezone: ${env.TZ || 'not set'}`);
  console.log(`\n✅ Ready to accept requests!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});
