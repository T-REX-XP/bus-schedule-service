# Cloudflare Workers Deployment Guide

## Overview

This EMT Valencia Bus Schedule API can be deployed to **Cloudflare Workers** for global edge deployment with zero cold starts and automatic scaling.

## Prerequisites

1. **Cloudflare Account**: [Sign up for free](https://dash.cloudflare.com/sign-up)
2. **Wrangler CLI**: Cloudflare's command-line tool
3. **Node.js**: Version 16.13 or later

## Installation

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate with Cloudflare.

## Configuration

### 1. Update `wrangler.toml`

The `wrangler.toml` file is already configured. Update the following if needed:

```toml
name = "emt-valencia-bus-api"  # Your worker name (will be part of the URL)
```

### 2. (Optional) Set up KV Namespace for Caching

For better performance, use Cloudflare KV to cache GTFS data:

```bash
# Create KV namespace
wrangler kv:namespace create "GTFS_CACHE"

# Copy the namespace ID and update wrangler.toml
```

Uncomment and update in `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "GTFS_CACHE"
id = "your-kv-namespace-id-here"
```

## Deployment

### Manual Deployment

```bash
# Deploy to production
wrangler deploy

# Deploy to a specific environment
wrangler deploy --env production
```

### Test Locally

```bash
# Run locally with Wrangler dev server
wrangler dev
```

Your API will be available at `http://localhost:8787`

## Automated Deployment (GitHub Actions)

### 1. Get Cloudflare Credentials

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **My Profile** > **API Tokens**
3. Create a token with **Edit Cloudflare Workers** permissions
4. Copy your **Account ID** from the Workers dashboard

### 2. Add GitHub Secrets

In your GitHub repository:

1. Go to **Settings** > **Secrets and variables** > **Actions**
2. Add the following secrets:
   - `CLOUDFLARE_API_TOKEN`: Your API token
   - `CLOUDFLARE_ACCOUNT_ID`: Your account ID

### 3. Deploy

Push to the `main` branch or manually trigger the workflow:

```bash
git push origin main
```

Or trigger manually from GitHub Actions tab.

## Access Your Deployed API

After deployment, your API will be available at:

```
https://emt-valencia-bus-api.your-subdomain.workers.dev
```

### Endpoints

- **API Docs**: `https://your-worker.workers.dev/docs`
- **Health Check**: `https://your-worker.workers.dev/`
- **Find Stop**: `https://your-worker.workers.dev/find-stop?name=plaza`
- **Find Route**: `https://your-worker.workers.dev/find-route?number=25`
- **Departures**: `https://your-worker.workers.dev/departures?route_id=25&stop_id=1234`

## Custom Domain

### Add a Custom Domain

```bash
wrangler domains add your-domain.com
```

Or configure in the Cloudflare Dashboard:
1. Go to **Workers & Pages**
2. Select your worker
3. Go to **Settings** > **Domains & Routes**
4. Add your custom domain

## Environment Variables

Set secrets (not visible in code):

```bash
wrangler secret put GTFS_URL
# Paste the URL when prompted
```

## Pricing

- **Free Tier**: 100,000 requests/day
- **Paid Plan**: $5/month for 10 million requests
- **KV Storage**: First 1 GB free

[Pricing Details](https://workers.cloudflare.com/#plans)

## Performance Benefits

✅ **Global Edge Network**: Deployed to 300+ data centers worldwide  
✅ **Zero Cold Starts**: Instant response times  
✅ **Auto Scaling**: Handles traffic spikes automatically  
✅ **Built-in DDoS Protection**: Cloudflare's security layer  
✅ **Free SSL**: HTTPS by default  

## Troubleshooting

### View Logs

```bash
wrangler tail
```

### Debug Locally

```bash
wrangler dev --local
```

### Check Deployment Status

```bash
wrangler deployments list
```

## Limitations

- **CPU Time**: 50ms on free tier, 30s on paid
- **Memory**: 128MB
- **Request Size**: 100MB max
- **Response Size**: No limit

For this bus schedule API, these limits are more than sufficient.

## Support

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Community Discord](https://discord.gg/cloudflaredev)

## Next Steps

1. Deploy with `wrangler deploy`
2. Test your endpoints
3. Set up monitoring in Cloudflare Dashboard
4. Configure custom domain (optional)
5. Enable KV caching for better performance (optional)

---

**Note**: The `src/worker.py` file adapts the FastAPI application to work with Cloudflare Workers' Python runtime. No changes to your main application code are needed!
