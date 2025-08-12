import { serve } from "bun";
import index from "./index.html";
import {
  GOOGLE_OAUTH_SCOPE,
  getMostRecentBroadcastAnyStatus,
  getYouTubeStreamKey,
  loadTokenFile,
  peekYouTubeStreamKey,
  saveTokenFile,
  type TokenResponse,
  upsertMostRecentActiveBroadcastTitleDescription,
} from "./youtube";

// Small helpers
function requireEnv(name: string): string {
  const v = Bun.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(/;\s*/)) {
    const [k, ...rest] = part.split("=");
    if (!k) continue;
    out[decodeURIComponent(k)] = decodeURIComponent(rest.join("="));
  }
  return out;
}

function setCookie(
  name: string,
  value: string,
  attrs: Record<string, string | true> = {},
) {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => (v === true ? k : `${k}=${v}`))
    .join("; ");
  return `${encodeURIComponent(name)}=${encodeURIComponent(value)}${attrStr ? `; ${attrStr}` : ""}`;
}

const server = serve({
  development: process.env.NODE_ENV !== "production" && {
    // Echo console logs from the browser to the server
    console: true,
    // Enable browser hot reloading in development
    hmr: true,
  },
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(_req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(_req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    "/api/oauth/google/callback": async (req) => {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookies = parseCookies(req.headers.get("cookie"));
      if (!code) return new Response("Missing code", { status: 400 });
      if (!state || cookies["oauth_state"] !== state) {
        return new Response("Invalid state", { status: 400 });
      }

      const client_id = requireEnv("GOOGLE_OAUTH_CLIENT_ID");
      const client_secret = requireEnv("GOOGLE_OAUTH_CLIENT_SECRET");
      const redirect_uri =
        Bun.env.GOOGLE_OAUTH_REDIRECT_URI ??
        new URL("/api/oauth/google/callback", req.url).toString();

      const body = new URLSearchParams({
        client_id,
        client_secret,
        code,
        grant_type: "authorization_code",
        redirect_uri,
      });

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        return new Response(`Token exchange failed: ${text}`, { status: 500 });
      }

      const token = (await tokenRes.json()) as TokenResponse;
      await saveTokenFile(token);

      // Redirect back to home
      return new Response(null, {
        headers: {
          Location: "/",
          // clear state cookie
          "Set-Cookie": setCookie("oauth_state", "", {
            HttpOnly: true,
            "Max-Age": "0",
            Path: "/",
            SameSite: "Lax",
          }),
        },
        status: 302,
      });
    },

    // --- OAuth: Google (Authorization Code) ---
    "/api/oauth/google/login": async (req) => {
      const clientId = requireEnv("GOOGLE_OAUTH_CLIENT_ID");
      const redirectUri =
        Bun.env.GOOGLE_OAUTH_REDIRECT_URI ??
        new URL("/api/oauth/google/callback", req.url).toString();
      const state = crypto.randomUUID();

      const params = new URLSearchParams({
        access_type: "offline",
        client_id: clientId,
        include_granted_scopes: "true",
        prompt: "consent",
        redirect_uri: redirectUri,
        response_type: "code",
        scope: GOOGLE_OAUTH_SCOPE,
        state,
      });

      const location = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return new Response(null, {
        headers: {
          Location: location,
          "Set-Cookie": setCookie("oauth_state", state, {
            HttpOnly: true,
            Path: "/",
            SameSite: "Lax",
          }),
        },
        status: 302,
      });
    },

    // Check if we have a saved refresh token
    "/api/youtube/auth-status": async () => {
      const saved = await loadTokenFile<TokenResponse>();
      const authorized = Boolean(saved?.refresh_token || saved?.access_token);
      return Response.json({ authorized });
    },

    // Latest broadcast info (any status)
    "/api/youtube/latest-broadcast": async () => {
      try {
        console.log("[API] GET /api/youtube/latest-broadcast");
        const info = await getMostRecentBroadcastAnyStatus();
        if (!info) return Response.json({ broadcast: null });
        console.log("[API] latest-broadcast ->", {
          id: info.id,
          status: info.status,
        });
        return Response.json({
          broadcast: {
            description: info.raw.snippet.description,
            id: info.id,
            status: info.status,
            title: info.title,
            url: info.url,
          },
        });
      } catch (error) {
        console.error("[API] latest-broadcast error:", error);
        return new Response(String(error), { status: 500 });
      }
    },

    // Save (update or create) broadcast title/description
    "/api/youtube/broadcast/save": {
      async POST(req) {
        try {
          console.log("[API] POST /api/youtube/broadcast/save");
          const body = (await req.json()) as {
            title?: string;
            description?: string;
          };
          console.log("[API] save body:", {
            titleLen: body.title?.length ?? 0,
            descLen: body.description?.length ?? 0,
          });
          const out = await upsertMostRecentActiveBroadcastTitleDescription({
            title: body.title,
            description: body.description,
          });
          console.log("[API] save ->", { id: out.id, status: out.status });
          return Response.json({
            broadcast: {
              description: out.raw.snippet.description,
              id: out.id,
              status: out.status,
              title: out.title,
              url: out.url,
            },
          });
        } catch (error) {
          console.error("[API] save error:", error);
          return new Response(String(error), { status: 500 });
        }
      },
    },

    // Requires prior authorization
    "/api/youtube/stream-key": async () => {
      try {
        console.log("[API] GET /api/youtube/stream-key");
        const { streamKey, ingestUrl } = await getYouTubeStreamKey();
        console.log("[API] stream-key ->", {
          hasKey: !!streamKey,
          hasIngest: !!ingestUrl,
        });
        return Response.json({ ingestUrl, streamKey });
      } catch (error) {
        console.error("[API] stream-key error:", error);
        return new Response(String(error), { status: 500 });
      }
    },

    // Non-creating peek at an existing reusable stream key
    "/api/youtube/stream-key/peek": async () => {
      try {
        console.log("[API] GET /api/youtube/stream-key/peek");
        const { streamKey, ingestUrl } = await peekYouTubeStreamKey();
        console.log("[API] stream-key/peek ->", {
          hasKey: !!streamKey,
          hasIngest: !!ingestUrl,
        });
        return Response.json({ ingestUrl, streamKey });
      } catch (error) {
        console.error("[API] stream-key/peek error:", error);
        return new Response(String(error), { status: 500 });
      }
    },
  },
});

console.log(`🚀 Server running at ${server.url}`);
