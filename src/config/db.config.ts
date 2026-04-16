import mongoose from "mongoose";
import env from "./env.config";
import logger from "./logger.config";

const connectDB = async (): Promise<void> => {
  try {
    mongoose.set("strictQuery", true); // Warn on unknown query fields

    const conn = await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45_000,
      serverSelectionTimeoutMS: 5_000,
      heartbeatFrequencyMS: 10_000,
    });

    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);

    // ─── Connection event listeners ───────────────────────────────

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected.");
    });

    // ─── Graceful shutdown ────────────────────────────────────────

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Closing MongoDB connection...`);
      await mongoose.connection.close();
      logger.info("MongoDB connection closed.");
      process.exit(0);
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    logger.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
};

export default connectDB;
