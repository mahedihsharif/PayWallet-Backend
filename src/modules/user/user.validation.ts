import Joi from "joi";

// ─── Update profile ───────────────────────────────────────────────
export const updateProfileSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).trim().optional(),
  phone: Joi.string()
    .pattern(/^01[3-9]\d{8}$/)
    .optional()
    .messages({
      "string.pattern.base": "Please provide a valid Bangladesh mobile number.",
    }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided.",
  });

// ─── Set transaction PIN (first time) ────────────────────────────
export const setPinSchema = Joi.object({
  pin: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.length": "PIN must be exactly 6 digits.",
      "string.pattern.base": "PIN must contain only digits.",
    }),
  confirmPin: Joi.string()
    .valid(Joi.ref("pin"))
    .required()
    .messages({ "any.only": "PINs do not match." }),
  password: Joi.string().required().messages({
    "any.required": "Account password is required to set a PIN.",
  }),
});

// ─── Change existing PIN ──────────────────────────────────────────
export const changePinSchema = Joi.object({
  currentPin: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required(),
  newPin: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.length": "New PIN must be exactly 6 digits.",
      "string.pattern.base": "PIN must contain only digits.",
    }),
  confirmPin: Joi.string()
    .valid(Joi.ref("newPin"))
    .required()
    .messages({ "any.only": "New PINs do not match." }),
});

// ─── Submit KYC ───────────────────────────────────────────────────
export const submitKycSchema = Joi.object({
  documentType: Joi.string()
    .valid("nid", "passport", "driving_license")
    .required()
    .messages({
      "any.only":
        "Document type must be one of: nid, passport, driving_license.",
    }),
  documentUrl: Joi.string().uri().required().messages({
    "string.uri": "documentUrl must be a valid URL (Cloudinary).",
    "any.required": "Document URL is required.",
  }),
  selfieUrl: Joi.string().uri().required().messages({
    "string.uri": "selfieUrl must be a valid URL (Cloudinary).",
    "any.required": "Selfie URL is required.",
  }),
});

// ─── Enable 2FA (verify token before enabling) ───────────────────
export const enable2FASchema = Joi.object({
  token: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.length": "TOTP token must be exactly 6 digits.",
      "string.pattern.base": "TOTP token must contain only digits.",
    }),
});

// ─── Verify 2FA token ─────────────────────────────────────────────
export const verify2FASchema = Joi.object({
  token: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required(),
});

// ─── Update notification preferences ─────────────────────────────
export const updatePreferencesSchema = Joi.object({
  emailNotifications: Joi.boolean().optional(),
  smsNotifications: Joi.boolean().optional(),
  transactionAlerts: Joi.boolean().optional(),
  loginAlerts: Joi.boolean().optional(),
  marketingCommunications: Joi.boolean().optional(),
}).min(1);

// ─── Admin: review KYC ───────────────────────────────────────────
export const reviewKycSchema = Joi.object({
  action: Joi.string().valid("approve", "reject").required(),
  rejectionReason: Joi.when("action", {
    is: "reject",
    then: Joi.string().min(10).max(500).required().messages({
      "any.required": "Rejection reason is required when rejecting KYC.",
      "string.min":
        "Please provide a detailed rejection reason (min 10 characters).",
    }),
    otherwise: Joi.optional(),
  }),
});
