import { Queue } from "bullmq";
import env from "../config/env.config";

const createQueue = (name: string): Queue =>
  new Queue(name, {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: {
      attempts: env.EMAIL_JOB_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: env.EMAIL_JOB_BACKOFF_DELAY,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

export const emailQueue = createQueue("emailQueue");
export const notificationQueue = createQueue("notificationQueue");
export const pdfQueue = createQueue("pdfQueue");
