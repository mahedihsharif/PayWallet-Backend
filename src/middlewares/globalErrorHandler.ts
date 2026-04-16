import { NextFunction, Request, Response } from "express";
import env from "../config/env.config";
import AppError from "../errorHelpers/AppError";
import handleCastError from "../helpers/handleCastError";
import handleDuplicateError from "../helpers/handleDuplicateError";
import handleValidationError from "../helpers/handleValidationError";
import handleZodError from "../helpers/handleZodError";
import { TErrorSources } from "../types/error.types";

const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = 500;
  let message = "Something went wrong!";
  let errorSources: TErrorSources[] = [];
  let type: string | null = null;

  // mongoose duplicate key error
  if ((err as any)?.code === 11000) {
    const simplifiedError = handleDuplicateError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
  }

  // mongoose cast error (ObjectId)
  else if ((err as any)?.name === "CastError") {
    const simplifiedError = handleCastError(err as any);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
  }

  // zod validation error
  else if ((err as any)?.name === "ZodError") {
    const simplifiedError = handleZodError(err as any);
    statusCode = simplifiedError.statusCode;
    errorSources = simplifiedError.errorSources as TErrorSources[];
    message = simplifiedError.message;
  }

  // mongoose validation error
  else if ((err as any)?.name === "ValidationError") {
    const simplifiedError = handleValidationError(err);
    statusCode = simplifiedError.statusCode;
    errorSources = simplifiedError.errorSources as TErrorSources[];
    message = simplifiedError.message;
  }

  // custom app error
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    type = err.type || null;
  }

  // generic error
  else if (err instanceof Error) {
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    type,
    errorSources: errorSources.length ? errorSources : null,
    stack: env.NODE_ENV === "DEVELOPMENT" ? (err as any)?.stack : null,
  });
};

export default globalErrorHandler;
