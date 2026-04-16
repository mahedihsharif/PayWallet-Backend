import cors from "cors";
import env from "./env.config";

const allowedOrigins = [
  env.FRONTEND_URL, // e.g. 'https://paywallet.com'
  // Add more origins for mobile app or staging:
  // 'https://staging.paywallet.com',
];

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, mobile apps, server-to-server)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: Origin '${origin}' is not allowed.`));
    }
  },

  credentials: true, // Required for cookies (httpOnly refresh tokens)

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-ID",
    "X-Idempotency-Key", // Custom header for idempotency
  ],

  exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],

  maxAge: 86_400, // Cache preflight for 24 hours (reduces OPTIONS requests)
};
