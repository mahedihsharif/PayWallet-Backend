import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import AppError from "src/errorHelpers/AppError";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { UserServices } from "./user.service";

// ─── GET /api/v1/users/me ─────────────────────────────────────────
const getProfile = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const decodedToken = req.user as JwtPayload;
    const result = await UserServices.getProfile(decodedToken._id);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User get Successfully!",
      data: result,
    });
  },
);

// ─── PATCH /api/v1/users/me ───────────────────────────────────────
export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await UserServices.updateProfile(
    String(req.user!._id),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully.",
    data: profile,
  });
});

// ─── POST /api/v1/users/me/avatar ────────────────────────────────
const uploadAvatar = catchAsync(async (req: Request, res: Response) => {
  if (!req.file)
    throw new AppError(httpStatus.BAD_REQUEST, "Please upload an image file.");

  const result = await UserServices.uploadAvatar(
    String(req.user!._id),
    req.file,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Avatar updated successfully.",
    data: result,
  });
});

export const UserControllers = {
  getProfile,
  updateProfile,
  uploadAvatar,
};
