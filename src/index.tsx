import { serve } from "bun";
import index from "./index.html";
import { auth } from "./services/auth";

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
  },
});

console.log(`🚀 Server running at ${server.url}`);
