import path from "path";
import winston from "winston";
import env from "./env.config";

// ─── Custom log format ────────────────────────────────────────────

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }), // Include stack traces
  winston.format.json(), // Machine-readable in production
);

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? "\n" + JSON.stringify(meta, null, 2)
      : "";
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  }),
);

// ─── Transports ───────────────────────────────────────────────────

const transports: winston.transport[] = [
  // Always log to console
  new winston.transports.Console({
    format: env.NODE_ENV === "DEVELOPMENT" ? devFormat : logFormat,
  }),
];

// In production, also write to files
if (env.NODE_ENV === "PRODUCTION") {
  transports.push(
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB per file
      maxFiles: 5, // Keep last 5 files
    }),
    new winston.transports.File({
      filename: path.join("logs", "combined.log"),
      format: logFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
  );
}

// ─── Logger instance ──────────────────────────────────────────────

const logger = winston.createLogger({
  level: env.NODE_ENV === "PRODUCTION" ? "info" : "debug",
  transports,
  // Prevent unhandled promise rejections from crashing silently
  exceptionHandlers: [
    new winston.transports.Console(),
    ...(env.NODE_ENV === "PRODUCTION"
      ? [
          new winston.transports.File({
            filename: path.join("logs", "exceptions.log"),
          }),
        ]
      : []),
  ],
  rejectionHandlers: [new winston.transports.Console()],
});

export default logger;
