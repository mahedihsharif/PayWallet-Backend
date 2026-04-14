/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from "http-status-codes";
import { TErrorSources, TGenericErrorResponse } from "../interface/error.types";

const handleValidationError = (err: any): TGenericErrorResponse => {
  const errorSources: TErrorSources[] = [];
  const errors = Object.values(err.errors);
  errors.forEach((errorObject: any) =>
    errorSources.push({
      path: errorObject.path,
      message: errorObject.message,
    })
  );
  return {
    statusCode: httpStatus.BAD_REQUEST,
    message: "Validation Error",
    errorSources,
  };
};

export default handleValidationError;
