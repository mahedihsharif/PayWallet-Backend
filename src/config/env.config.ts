import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// ─── Define the shape and validation rules for every env variable ─

const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(["DEVELOPMENT", "TEST", "PRODUCTION"])
    .default("DEVELOPMENT"),
  PORT: z.string().default("5000").transform(Number),

  // MongoDB
  MONGODB_URI: z.url({ message: "MONGODB_URI must be a valid URL" }),

  // Redis
  REDIS_URL: z.url({ message: "REDIS_URL must be a valid URL" }),

  // JWT
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // Email (Nodemailer)
  // SMTP_HOST: z.string(),
  // SMTP_PORT: z.string().transform(Number),
  // SMTP_USER: z.email(),
  // SMTP_PASS: z.string(),
  // EMAIL_FROM: z.string().default("PayWallet <noreply@paywallet.com>"),

  //SSL
  // SSL_STORE_ID: z.string(),
  // SSL_STORE_PASS: z.string(),
  BCRYPT_SALT_ROUND: z.string().transform(Number),

  // SSLCommerz (Payment Gateway)
  // SSLCOMMERZ_STORE_ID: z.string(),
  // SSLCOMMERZ_STORE_PASS: z.string(),
  // SSLCOMMERZ_IS_LIVE: z
  //   .string()
  //   .transform((v) => v === "true")
  //   .default(false),

  // Cloudinary (File uploads)
  // CLOUDINARY_CLOUD_NAME: z.string(),
  // CLOUDINARY_API_KEY: z.string(),
  // CLOUDINARY_API_SECRET: z.string(),

  // GOOGLE_CLIENT_SECRET
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string(),
  EXPRESS_SESSION_SECRET: z.string(),

  // App
  FRONTEND_URL: z.url().default("http://localhost:5173"),
  // ENCRYPTION_KEY: z
  //   .string()
  //   .length(32, "ENCRYPTION_KEY must be exactly 32 chars"),
});

// ─── Parse and validate on startup ───────────────────────────────

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error("\n❌ Invalid environment variables:\n");

  _parsed.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  });

  console.error("\nFix the above and restart the server.\n");
  process.exit(1);
}

const env = _parsed.data; // now safe
export default env;
