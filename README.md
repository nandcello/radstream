# Radstream

Full-stack Bun + React app with a YouTube OAuth flow and minimal APIs.

## Prerequisites

- Bun 1.2+
- A Google Cloud project with OAuth consent screen configured

## Google OAuth setup

1. Go to Google Cloud Console → APIs & Services → Credentials → Create Credentials → OAuth client ID
2. Choose Web application
3. Authorized redirect URI: `http://localhost:3000/api/oauth/google/callback` (or your host)
4. Copy Client ID and Client Secret
5. Enable YouTube Data API v3 in APIs & Services → Library

## Environment variables

Bun loads `.env` automatically. Create a `.env` file in the repo root with:

```
GOOGLE_OAUTH_CLIENT_ID=your_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
# Optional: override when not using localhost:3000
# GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback

# Where to store the token JSON (optional)
# YT_TOKEN_PATH=.yt-oauth-token.json
```

## Install & run

```bash
bun install
bun dev
```

App will be at http://localhost:3000

## Using the YouTube flow

1. Open the app in your browser
2. Click "Connect YouTube" → complete Google consent
3. Back on the app, click "Get Stream Key" to fetch (and create if needed) a reusable stream key
