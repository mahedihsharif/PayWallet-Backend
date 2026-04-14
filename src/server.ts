import { Server } from "http";
import mongoose from "mongoose";
import app from "./app";
import { env } from "./config/env";

let server: Server;

const startServer = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log("Mongodb Connected Successfully!");
    server = app.listen(env.PORT, () => {
      console.log(`Server is Listening at Port: ${env.PORT}`);
    });
  } catch (error) {
    console.log(error);
  }
};

(async () => {
  await startServer();
})();

/**
 * unhandled rejection
 * uncaught rejection
 * Signal Terminal Rejection
 */

process.on("unhandledRejection", (err) => {
  console.log("Unhandled Rejection Detected...Server Shutting down.", err);
  if (server) {
    server.close();
    process.exit(1);
  }
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.log("UnCaught Exception Detected...Server Shutting down.", err);
  if (server) {
    server.close();
    process.exit(1);
  }
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("Signal Terminal Detected...Server Shutting down.");
  if (server) {
    server.close();
    process.exit(1);
  }
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("SIGINT Detected...Server Shutting down.");
  if (server) {
    server.close();
    process.exit(1);
  }
  process.exit(1);
});

//unhandled rejection error.
// Promise.reject(new Error("I forgot to catch the promise"));
//uncaught detection error
// throw new Error("I forgot to catch this local error");
