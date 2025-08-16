import { serve } from "bun";
import index from "./index.html";
import { auth } from "./services/auth";
import { Broadcast } from "./services/youtube/broadcast";
import * as LiveStream from "./services/youtube/livestream";

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

        await Broadcast.updateBroadcastTitleDescription({
          id: body.id,
          title: body.title,
          description: body.description,
          accessToken: accessToken.accessToken,
        });

        return Response.json({});
      },
    },
    "/api/broadcast/status": {
      GET: async (req) => {
        const accessToken = await auth.api.getAccessToken({
          body: {
            providerId: "google",
          },
          headers: req.headers,
        });

        if (!accessToken.accessToken)
          return Response.json({ error: "Unauthorized" }, { status: 401 });

        const latestBroadcast = await Broadcast.latestTitleAndDescription({
          accessToken: accessToken.accessToken,
        });

        console.log(
          ">>> broadcast status",
          JSON.stringify(latestBroadcast, null, 2),
        );

        if (!latestBroadcast?.id)
          return Response.json({ error: "Not Found" }, { status: 404 });

        const status = await Broadcast.status({
          id: latestBroadcast.id,
          accessToken: accessToken.accessToken,
        });

        return Response.json({
          status: status !== "live" ? "standby" : "live",
        });
      },
    },
    "/livestream/health": {
      GET: async (req) => {
        const accessToken = await auth.api.getAccessToken({
          body: {
            providerId: "google",
          },
          headers: req.headers,
        });

        if (!accessToken.accessToken)
          return Response.json({ error: "Unauthorized" }, { status: 401 });

        const healthStatus = await LiveStream.getHealthStatus({
          accessToken: accessToken.accessToken,
        });

        return Response.json(healthStatus);
      },
    },
    "/api/livestream/stream-key": {
      GET: async (req) => {
        const accessToken = await auth.api.getAccessToken({
          body: {
            providerId: "google",
          },
          headers: req.headers,
        });

        if (!accessToken.accessToken)
          return Response.json({ error: "Unauthorized" }, { status: 401 });

        const streamKey = await LiveStream.streamKey({
          accessToken: accessToken.accessToken,
        });

        return Response.json({ streamKey });
      },
    },
    "/api/livestream/status": {
      GET: async (req) => {
        const accessToken = await auth.api.getAccessToken({
          body: {
            providerId: "google",
          },
          headers: req.headers,
        });

        if (!accessToken.accessToken)
          return Response.json({ error: "Unauthorized" }, { status: 401 });

        let status = await LiveStream.status({
          accessToken: accessToken.accessToken,
        });

        switch (status) {
          case "active":
            status = "streaming";
            break;
          case "error":
            status = "lost connection";
            break;
          default:
            status = "waiting for connection..";
            break;
        }

        return Response.json({ status });
      },
    },
  },
});

console.log(`🚀 Server running at ${server.url}`);
