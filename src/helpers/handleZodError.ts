import httpStatus from "http-status-codes";
import { ZodError } from "zod";
import { TErrorSources, TGenericErrorResponse } from "../types/error.types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const handleZodError = (err: ZodError): TGenericErrorResponse => {
  const errorSources: TErrorSources[] = [];
  const errors = err.issues;
  errors.forEach((issue: any) =>
    errorSources.push({
      path: issue.path[issue.path.length - 1],
      message: issue.message,
    }),
  );
  return {
    statusCode: httpStatus.BAD_REQUEST,
    message: "Zod Error",
    errorSources,
  };
};
export default handleZodError;
