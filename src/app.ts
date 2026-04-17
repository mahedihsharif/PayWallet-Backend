import { corsOptions } from "@config/cors.config";
import logger from "@config/logger.config";
import { globalLimiter } from "@middlewares/rateLimiter.middleware";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "crypto";
import express, { Application, NextFunction, Request, Response } from "express";
import expressSession from "express-session";
import helmet from "helmet";
import morgan from "morgan";
import passport from "passport";
import env from "./config/env.config";
import "./config/passport.config";
import globalErrorHandler from "./middlewares/globalErrorHandler";
import notFound from "./middlewares/notFound";
import { router } from "./routes";

const app: Application = express();
// ─── 1. Security headers (Helmet) — always first ──────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

if (env.NODE_ENV === "PRODUCTION") {
  app.use(
    helmet.hsts({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    }),
  );
}

app.use(cors(corsOptions));
app.options("/{*splat}", cors(corsOptions)); // Handle preflight requests

app.use(
  expressSession({
    secret: env.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());

// ─── 4. Compression ───────────────────────────────────────────────
app.use(compression());

// ─── 5. NoSQL injection prevention ────────────────────────────────
// Strips $ and . from req.body, req.query, req.params
app.use((req, _res, next) => {
  const clean = (obj: any) => {
    if (!obj || typeof obj !== "object") return;

    Object.keys(obj).forEach((key) => {
      if (key.includes("$") || key.includes(".")) {
        delete obj[key];
      }
    });
  };

  clean(req.body);
  clean(req.query);
  clean(req.params);

  next();
});
// ─── 6. Request ID (log correlation) ─────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.requestId =
    (req.headers["x-request-id"] as string) ?? crypto.randomUUID();
  next();
});

// ─── 7. HTTP request logging ──────────────────────────────────────
if (env.NODE_ENV === "DEVELOPMENT") {
  // Concise colored output in development
  app.use(morgan("dev"));
} else {
  // Structured JSON logs in production
  app.use(
    morgan("combined", {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: (_req, res) => res.statusCode < 400, // Only log errors in prod
    }),
  );
}
// ─── 8. Global rate limiter ───────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith("/api/v1/auth")) return next();
  return globalLimiter(req, res, next);
});
app.use("/api/v1", router);
app.use(notFound);
app.use(globalErrorHandler);

export default app;
