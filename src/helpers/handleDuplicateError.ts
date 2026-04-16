/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from "http-status-codes";
import { TGenericErrorResponse } from "../types/error.types";

const handleDuplicateError = (err: any): TGenericErrorResponse => {
  let matchedArray = err.message.match(/"([^"]*)"/)?.[1] || null;
  if (!matchedArray) matchedArray = "unknown field";
  return {
    statusCode: httpStatus.BAD_REQUEST,
    message: `${matchedArray} already exist!`,
  };
};

export default handleDuplicateError;
