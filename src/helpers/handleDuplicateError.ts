/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from "http-status-codes";
import { TGenericErrorResponse } from "../interface/error.types";

const handleDuplicateError = (err: any): TGenericErrorResponse => {
  const matchedArray = err.message.match(/"([^"]*)"/)?.[1] || null;

  return {
    statusCode: httpStatus.BAD_REQUEST,
    message: `${matchedArray} already exist!`,
  };
};

export default handleDuplicateError;
