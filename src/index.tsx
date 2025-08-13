import { serve } from "bun";
import index from "./index.html";
import { auth } from "./services/auth";
import { Broadcast } from "./services/youtube/broadcast";
import {
  getMostRecentBroadcastAnyStatus,
  getYouTubeStreamKey,
  peekYouTubeStreamKey,
  upsertMostRecentActiveBroadcastTitleDescription,
} from "./youtube";

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
    "/api/*": {
      POST: (req) => auth.handler(req),
      GET: (req) => auth.handler(req),
    },

    "/api/broadcast/fields": {
      GET: async (req) => {
        const accessToken = await auth.api.getAccessToken({
          body: {
            providerId: "google",
          },
          headers: req.headers,
        });

        if (!accessToken.accessToken)
          return Response.json({ error: "Unauthorized" }, { status: 401 });

        return Response.json(
          await Broadcast.latestTitleAndDescription({
            accessToken: accessToken.accessToken,
          }),
        );
      },
      POST: async (req) => {
        const accessToken = await auth.api.getAccessToken({
          body: {
            providerId: "google",
          },
          headers: req.headers,
        });

        if (!accessToken.accessToken)
          return Response.json({ error: "Unauthorized" }, { status: 401 });

        const body = (await req.json()) as {
          id?: string;
          title?: string;
          description?: string;
        };

        console.log(">>> doing it");

        await Broadcast.updateBroadcastTitleDescription({
          id: body.id,
          title: body.title,
          description: body.description,
          accessToken: accessToken.accessToken,
        });

        return Response.json({});
      },
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
            streamStatus: info.streamStatus,
            healthStatus: info.healthStatus,
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
              streamStatus: out.streamStatus,
              healthStatus: out.healthStatus,
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
        const { streamKey, ingestUrl, streamStatus, healthStatus } =
          await getYouTubeStreamKey();
        console.log("[API] stream-key ->", {
          hasKey: !!streamKey,
          hasIngest: !!ingestUrl,
        });
        return Response.json({
          ingestUrl,
          streamKey,
          streamStatus,
          healthStatus,
        });
      } catch (error) {
        console.error("[API] stream-key error:", error);
        return new Response(String(error), { status: 500 });
      }
    },

    // Non-creating peek at an existing reusable stream key
    "/api/youtube/stream-key/peek": async () => {
      try {
        console.log("[API] GET /api/youtube/stream-key/peek");
        const { streamKey, ingestUrl, streamStatus, healthStatus } =
          await peekYouTubeStreamKey();
        console.log("[API] stream-key/peek ->", {
          hasKey: !!streamKey,
          hasIngest: !!ingestUrl,
        });
        return Response.json({
          ingestUrl,
          streamKey,
          streamStatus,
          healthStatus,
        });
      } catch (error) {
        console.error("[API] stream-key/peek error:", error);
        return new Response(String(error), { status: 500 });
      }
    },
  },
});

console.log(`🚀 Server running at ${server.url}`);
