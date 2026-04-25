import Joi from "joi";

// ─── Top-up ───────────────────────────────────────────────────────
export const topUpInitiateSchema = Joi.object({
  amount: Joi.number()
    .integer()
    .min(10_000) // Minimum top-up: ৳100
    .max(500_000_00) // Maximum top-up: ৳500,000
    .required()
    .messages({
      "number.integer": "Amount must be in paisa (integer). ৳1 = 100 paisa.",
      "number.min": "Minimum top-up amount is ৳100.",
      "number.max": "Maximum single top-up is ৳500,000.",
      "any.required": "Amount is required.",
    }),
  currency: Joi.string().valid("BDT", "USD", "EUR").default("BDT"),
});

// ─── Withdraw ─────────────────────────────────────────────────────
export const withdrawSchema = Joi.object({
  amount: Joi.number()
    .integer()
    .min(50_000) // Minimum withdrawal: ৳500
    .max(500_000_00)
    .required()
    .messages({
      "number.integer": "Amount must be in paisa.",
      "number.min": "Minimum withdrawal is ৳500.",
      "any.required": "Amount is required.",
    }),
  bankAccountName: Joi.string().min(3).max(100).trim().required(),
  bankAccountNo: Joi.string()
    .pattern(/^\d{9,18}$/)
    .required()
    .messages({
      "string.pattern.base": "Bank account number must be 9–18 digits.",
    }),
  bankName: Joi.string().min(2).max(100).trim().required(),
  routingNumber: Joi.string()
    .pattern(/^\d{9}$/)
    .optional()
    .messages({
      "string.pattern.base": "Routing number must be 9 digits.",
    }),
  pin: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.length": "PIN must be exactly 6 digits.",
      "string.pattern.base": "PIN must contain only digits.",
      "any.required": "Transaction PIN is required.",
    }),
});

// ─── Admin: update wallet limits ──────────────────────────────────
export const updateLimitsSchema = Joi.object({
  dailyDebit: Joi.number().integer().min(0).optional(),
  weeklyDebit: Joi.number().integer().min(0).optional(),
  monthlyDebit: Joi.number().integer().min(0).optional(),
  singleTransactionMax: Joi.number().integer().min(0).optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one limit field must be provided.",
  });

// ─── Webhook payload (loose — gateway sends unpredictable fields) ─
export const webhookSchema = Joi.object({
  status: Joi.string().required(),
  tran_id: Joi.string().required(),
  val_id: Joi.string().optional(),
  amount: Joi.string().required(),
  currency: Joi.string().required(),
  store_id: Joi.string().required(),
  store_passwd: Joi.string().required(),
  verify_sign: Joi.string().required(),
  verify_key: Joi.string().required(),
}).unknown(true); // Allow extra fields from gateway
