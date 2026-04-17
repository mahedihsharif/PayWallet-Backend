import Joi from "joi";
import { OtpPurpose } from "./otp.types";

const emailField = Joi.string()
  .email({ tlds: { allow: false } }) // Don't validate TLD (dev-friendly)
  .lowercase()
  .trim()
  .required()
  .messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
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

export const resendOtpSchema = Joi.object({
  email: emailField,
  purpose: Joi.string()
    .valid(OtpPurpose.EMAIL_VERIFY, OtpPurpose.PASSWORD_RESET)
    .required(),
});
