import { Job, Worker } from "bullmq";
import nodemailer from "nodemailer";
import env from "../config/env.config";
import logger from "../config/logger.config";

// ─── Nodemailer transporter ───────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // true for 465 (SSL), false for 587 (TLS)
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

// ─── Email templates (inline HTML — use a template engine in production) ─

const templates = {
  sendVerificationEmail: (data: { fullName: string; otpCode: string }) => ({
    subject: "Verify your PayWallet email",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Welcome to PayWallet, ${data.fullName}!</h2>
        <p>Your email verification code is:</p>
        <div style="background: #f0f4ff; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">
            ${data.otpCode}
          </span>
        </div>
        <p style="color: #666;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="color: #666;">If you didn't create a PayWallet account, ignore this email.</p>
      </div>
    `,
  }),

  sendPasswordResetEmail: (data: { fullName: string; otpCode: string }) => ({
    subject: "Reset your PayWallet password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Password Reset Request</h2>
        <p>Hi ${data.fullName},</p>
        <p>Your password reset code is:</p>
        <div style="background: #fff3f3; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #e53e3e;">
            ${data.otpCode}
          </span>
        </div>
        <p style="color: #666;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="color: #e53e3e; font-weight: bold;">
          If you didn't request this, please secure your account immediately.
        </p>
      </div>
    `,
  }),

  sendWelcomeEmail: (data: { fullName: string }) => ({
    subject: "Welcome to PayWallet 🎉",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Your wallet is ready, ${data.fullName}!</h2>
        <p>Welcome to PayWallet. Your account is now fully verified.</p>
        <p>You can now:</p>
        <ul>
          <li>Send and receive money instantly</li>
          <li>Top up your wallet</li>
          <li>Complete KYC for higher limits</li>
        </ul>
      </div>
    `,
  }),

  sendNewDeviceAlert: (data: {
    fullName: string;
    deviceName: string;
    ipAddress: string;
    timestamp: string;
  }) => ({
    subject: "⚠️ New device login detected — PayWallet",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e53e3e;">New Device Login</h2>
        <p>Hi ${data.fullName},</p>
        <p>Your PayWallet account was accessed from a new device:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #666;">Device</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${data.deviceName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #666;">IP Address</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${data.ipAddress}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #666;">Time</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${data.timestamp}</td>
          </tr>
        </table>
        <p style="color: #e53e3e;">
          If this wasn't you, please change your password immediately and log out all devices.
        </p>
      </div>
    `,
  }),

  sendPasswordChangedEmail: (data: { fullName: string }) => ({
    subject: "Your PayWallet password was changed",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Password Changed</h2>
        <p>Hi ${data.fullName},</p>
        <p>Your PayWallet password was successfully changed.</p>
        <p style="color: #e53e3e;">
          If you did not make this change, contact support immediately.
        </p>
      </div>
    `,
  }),
  send2FAEnabledEmail: (data: { fullName: string }) => ({
    subject: "Two-Factor Authentication Enabled on Your PayWallet Account",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Two-Factor Authentication Enabled</h2>

      <p>Hi ${data.fullName},</p>

      <p>
        Great news — Two-Factor Authentication (2FA) has been successfully enabled on your PayWallet account.
      </p>

      <p>
        From now on, you will need to enter a verification code from your authenticator app every time you log in. This adds an extra layer of security to your account.
      </p>

      <p style="color: #38a169;">
        Your account is now significantly more secure.
      </p>

      <hr style="margin: 20px 0;" />

      <p style="font-size: 12px; color: #666;">
        If you did not enable this feature, please secure your account immediately by changing your password and contacting support.
      </p>
    </div>
  `,
  }),
  send2FADisabledEmail: (data: { fullName: string }) => ({
    subject: "Your PayWallet 2FA has been disabled",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Two-Factor Authentication Disabled</h2>

      <p>Hi ${data.fullName},</p>

      <p>
        Your Two-Factor Authentication (2FA) has been successfully disabled on your PayWallet account.
      </p>

      <p style="color: #e53e3e;">
        If you did not request this change, your account may be at risk. Please secure your account immediately by resetting your password and contacting support.
      </p>

      <hr style="margin: 20px 0;" />

      <p style="font-size: 12px; color: #666;">
        For your security, we recommend enabling 2FA again as soon as possible.
      </p>
    </div>
  `,
  }),
};

// ─── The worker — processes jobs from the emailQueue ─────────────

const emailWorker = new Worker(
  "emailQueue",
  async (job: Job) => {
    const { name, data } = job;

    logger.debug(`Processing email job: ${name}`, { jobId: job.id });

    // Get template based on job name
    const templateFn = templates[name as keyof typeof templates];
    if (!templateFn) {
      throw new Error(`No email template found for job: ${name}`);
    }

    const template = templateFn(data as never);

    await transporter.sendMail({
      from: `"PayWallet" <${env.SMTP_USER}>`,
      to: data.to as string,
      subject: template.subject,
      html: template.html,
    });

    logger.info(`Email sent: ${name} to ${data.to as string}`);
  },
  { connection: { url: env.REDIS_URL } },
);

// ─── Event listeners for debugging ───────────────────────────────

emailWorker.on("ready", () => {
  logger.info("Email worker is ready");
});

emailWorker.on("active", (jobId) => {
  logger.debug(`Email job ${jobId} is active`);
});

emailWorker.on("completed", (jobId) => {
  logger.debug(`Email job completed`, { jobId });
});

emailWorker.on("failed", (jobId, err) => {
  logger.error(`Email job failed`, {
    jobId,
    error: err.message,
  });
});

export default emailWorker;
