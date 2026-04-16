import Joi from "joi";

// ─── Reusable field definitions ───────────────────────────────────

const emailField = Joi.string()
  .email({ tlds: { allow: false } }) // Don't validate TLD (dev-friendly)
  .lowercase()
  .trim()
  .required()
  .messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  });

const passwordField = Joi.string()
  .min(8)
  .max(72) // bcrypt max is 72 bytes
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, "password")
  .required()
  .messages({
    "string.min": "Password must be at least 8 characters",
    "string.max": "Password cannot exceed 72 characters",
    "string.pattern.name":
      "Password must include uppercase, lowercase, number, and special character (@$!%*?&)",
    "any.required": "Password is required",
  });

const phoneField = Joi.string()
  .pattern(/^01[3-9]\d{8}$/)
  .required()
  .messages({
    "string.pattern.base":
      "Please provide a valid Bangladesh mobile number (e.g. 01712345678)",
    "any.required": "Phone number is required",
  });

const otpField = Joi.string()
  .length(6)
  .pattern(/^\d{6}$/)
  .required()
  .messages({
    "string.length": "OTP must be exactly 6 digits",
    "string.pattern.base": "OTP must contain only digits",
    "any.required": "OTP code is required",
  });

// ─── Exported schemas ─────────────────────────────────────────────

export const registerSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).trim().required().messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 100 characters",
    "any.required": "Full name is required",
  }),
  email: emailField,
  phone: phoneField,
  password: passwordField,
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Please confirm your password",
  }),
});

export const verifyEmailSchema = Joi.object({
  email: emailField,
  code: otpField,
});

export const loginSchema = Joi.object({
  email: emailField,
  password: Joi.string()
    .required()
    .messages({ "any.required": "Password is required" }),
  deviceId: Joi.string().uuid().required().messages({
    "string.guid": "deviceId must be a valid UUID",
    "any.required": "deviceId is required",
  }),
  deviceName: Joi.string().max(100).required().messages({
    "any.required": "deviceName is required",
  }),
});

export const forgotPasswordSchema = Joi.object({
  email: emailField,
});

export const resetPasswordSchema = Joi.object({
  email: emailField,
  code: otpField,
  newPassword: passwordField,
  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "any.required": "Please confirm your new password",
    }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordField,
  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({ "any.only": "Passwords do not match" }),
});

export const resendOtpSchema = Joi.object({
  email: emailField,
  purpose: Joi.string().valid("EMAIL_VERIFY", "PASSWORD_RESET").required(),
});
