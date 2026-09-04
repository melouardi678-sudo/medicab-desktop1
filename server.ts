import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

const envPath = process.env.NODE_ENV === "production" && (process as any).resourcesPath 
  ? path.join((process as any).resourcesPath, '.env') 
  : path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });

export async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint for container lifecycle
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Vite middleware for development vs Static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(__dirname, "index.html"))
      ? __dirname
      : path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      resolve(server);
    });

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`Port ${PORT} is already in use, reusing active server.`);
        resolve(server);
      } else {
        console.error("Server error:", err);
        reject(err);
      }
    });
  });
}

startServer().catch((err) => {
  console.error("Fatal server error on startup:", err);
});
