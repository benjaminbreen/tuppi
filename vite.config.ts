import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Vite exposes only VITE_ variables to the browser. Both optional Jev keys
  // stay in this local server process, matching the server-side Vercel function.
  const localEnv = loadEnv(mode, process.cwd(), "");
  for (const name of ["OPENROUTER_API_KEY", "TYPESAFE_API_KEY"] as const) {
    if (!process.env[name] && localEnv[name]) process.env[name] = localEnv[name];
  }
  return {
    plugins: [react(), {
      name: "local-ritual-composer-api",
      configureServer(server) {
        server.middlewares.use("/r", async (req, res, next) => {
          if (!req.url?.startsWith("/")) return next();
          try {
            const { default: handler } = await import("./api/share.js");
            const response = await handler.fetch(new Request(`http://localhost/r${req.url}`, { method: req.method }));
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch { res.statusCode = 500; res.end("Share link unavailable"); }
        });
        server.middlewares.use("/api/compose", async (req, res) => {
          try {
            const chunks: Uint8Array[] = [];
            for await (const chunk of req) chunks.push(chunk);
            const body = Buffer.concat(chunks);
            const { default: handler } = await import("./api/compose.js");
            const response = await handler.fetch(new Request("http://localhost/api/compose", {
              method: req.method,
              headers: {
                "content-type": req.headers["content-type"] ?? "",
                "content-length": String(body.length),
                "x-forwarded-for": "127.0.0.1",
              },
              body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
            }));
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "local_api_error" }));
          }
        });
      },
    }],
  };
});
