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
    const result = await UserServices.getProfile(String(decodedToken!._id));
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User get Successfully!",
      data: result,
    });
  },
);

// ─── PATCH /api/v1/users/me ───────────────────────────────────────
export const updateProfile = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const decodedToken = req.user as JwtPayload;
    const profile = await UserServices.updateProfile(
      String(decodedToken!._id),
      req.body,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Profile updated successfully.",
      data: profile,
    });
  },
);

// ─── POST /api/v1/users/me/avatar ────────────────────────────────
const uploadAvatar = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file)
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Please upload an image file.",
      );
    const decodedToken = req.user as JwtPayload;
    const result = await UserServices.uploadAvatar(
      String(decodedToken!._id),
      req.file,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Avatar updated successfully.",
      data: result,
    });
  },
);

// ─── DELETE /api/v1/users/me ──────────────────────────────────────
const requestAccountDeletion = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { password } = req.body as { password: string };
    const decodedToken = req.user as JwtPayload;
    const result = await UserServices.requestAccountDeletion(
      String(decodedToken!._id),
      password,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: result.message,
      data: "",
    });
  },
);

// ─── POST /api/v1/users/me/pin/set ───────────────────────────────
const setPin = catchAsync(async (req: Request, res: Response) => {
  const decodedToken = req.user as JwtPayload;
  const result = await UserServices.setPin(String(decodedToken!._id), req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: "",
  });
});

// ─── PATCH /api/v1/users/me/pin/change ───────────────────────────
const changePin = catchAsync(async (req: Request, res: Response) => {
  const decodedToken = req.user as JwtPayload;
  const result = await UserServices.changePin(
    String(decodedToken!._id),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: "",
  });
});

export const UserControllers = {
  getProfile,
  updateProfile,
  uploadAvatar,
  requestAccountDeletion,
  setPin,
  changePin,
};
