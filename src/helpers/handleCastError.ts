/* eslint-disable @typescript-eslint/no-unused-vars */
import httpStatus from "http-status-codes";
import mongoose from "mongoose";
import { TGenericErrorResponse } from "../interface/error.types";

const handleCastError = (
  err: mongoose.Error.CastError
): TGenericErrorResponse => {
  return {
    statusCode: httpStatus.BAD_REQUEST,
    message: "Invalid MongoDB ObjectID. Please provide a valid id",
  };
};
export default handleCastError;
