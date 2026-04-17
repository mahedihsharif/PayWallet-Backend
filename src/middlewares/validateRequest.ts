import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status-codes";
import Joi from "joi";
import AppError from "src/errorHelpers/AppError";

type ValidateTarget = "body" | "query" | "params";

// ─── Factory: returns a middleware for a given Joi schema ─────────

const validateRequest = (
  schema: Joi.ObjectSchema,
  target: ValidateTarget = "body",
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false, // Collect ALL errors, not just the first
      stripUnknown: true, // Remove fields not in schema (security)
      convert: true, // Coerce types (string '5' → number 5)
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message.replace(/['"]/g, ""),
      }));

      // Replace raw input with validated+sanitized value
      // This strips unknown fields before they reach the service
      throw new AppError(
        httpStatus.UNPROCESSABLE_ENTITY,
        "Validation failed",
        JSON.stringify(errors),
      );
    }

    // Replace req[target] with the sanitized, validated value
    req[target] = value;
    next();
  };
};

export default validateRequest;
