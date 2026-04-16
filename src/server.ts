import http from "http";
import { Server as SocketIOServer } from "socket.io";
import connectDB from "./config/db.config";
import logger from "./config/logger.config";
import redis from "./config/redis.config";

// ─── Import event listeners (registers them on startup) ───────────
import env from "@config/env.config";
import app from "./app";
import "./events/listeners/transaction.listener";
import "./events/listeners/user.listener";

let httpServer: http.Server;

const startServer = async (): Promise<void> => {
  try {
    // ─── 1. Connect MongoDB ─────────────────────────────
    await connectDB();

    // ─── 2. Wait Redis ready ────────────────────────────
    await redis.connect?.().catch(() => {}); // safe for ioredis

    await redis.ping();
    logger.info("✅ Redis ping successful.");

    // ─── 3. Create HTTP server ─────────────────────────
    httpServer = http.createServer(app);

    // ─── 4. Socket.IO ─────────────────────────────────
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: env.FRONTEND_URL,
        methods: ["GET", "POST"],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    app.locals.io = io;

    io.on("connection", (socket) => {
      logger.debug(`Socket connected: ${socket.id}`);

      socket.on("join", (userId: string) => {
        socket.join(`user:${userId}`);
        logger.debug(`Socket ${socket.id} joined user:${userId}`);
      });

      socket.on("disconnect", () => {
        logger.debug(`Socket disconnected: ${socket.id}`);
      });
    });

    // ─── 5. Start server ──────────────────────────────
    httpServer.listen(env.PORT, () => {
      logger.info(`
╔═══════════════════════════════════════════╗
║          PayWallet API Server             ║
╠═══════════════════════════════════════════╣
║  Status   : Running                       ║
║  Port     : ${String(env.PORT).padEnd(30)} ║
║  Env      : ${env.NODE_ENV.padEnd(30)} ║
║  API      : /api/v1/health                ║
╚═══════════════════════════════════════════╝
`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// ───────────────── GLOBAL ERROR HANDLERS ─────────────────

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection", err);

  if (httpServer) {
    httpServer.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", err);

  if (httpServer) {
    httpServer.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// ───────────────── GRACEFUL SHUTDOWN ─────────────────

process.on("SIGTERM", () => {
  logger.warn("SIGTERM received. Shutting down...");
  httpServer?.close();
});

process.on("SIGINT", () => {
  logger.warn("SIGINT received. Shutting down...");
  httpServer?.close();
});
