import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import AppError from "src/errorHelpers/AppError";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { UserServices } from "./user.service";
import { UserStatus } from "./user.types";

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

// ─── POST /api/v1/users/me/kyc ───────────────────────────────────
const submitKyc = catchAsync(async (req: Request, res: Response) => {
  const decodedToken = req.user as JwtPayload;
  const result = await UserServices.submitKyc(
    String(decodedToken!._id),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: { status: result.status },
  });
});

// ─── POST /api/v1/users/me/2fa/setup ─────────────────────────────
const setup2FA = catchAsync(async (req: Request, res: Response) => {
  const decodedToken = req.user as JwtPayload;
  const result = await UserServices.setup2FA(String(decodedToken!._id));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message:
      "Scan the QR code with your authenticator app, then call /2fa/enable to confirm.",
    data: result,
  });
});

// ─── POST /api/v1/users/me/2fa/enable ────────────────────────────
const enable2FA = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  const decodedToken = req.user as JwtPayload;
  const result = await UserServices.enable2FA(String(decodedToken!._id), token);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: "",
  });
});

// ─── POST /api/v1/users/me/2fa/disable ───────────────────────────
const disable2FA = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  const decodedToken = req.user as JwtPayload;
  const result = await UserServices.disable2FA(
    String(decodedToken!._id),
    token,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: "",
  });
});

// ─── GET /api/v1/users/me/devices ────────────────────────────────
const getDevices = catchAsync(async (req: Request, res: Response) => {
  const decodedToken = req.user as JwtPayload;
  const devices = await UserServices.getDevices(String(decodedToken!._id));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Devices retrieved.",
    data: devices,
  });
});

// ─── DELETE /api/v1/users/me/devices/:deviceId ───────────────────
const removeDevice = catchAsync(async (req: Request, res: Response) => {
  const decodedToken = req.user as JwtPayload;
  const result = await UserServices.removeDevice(
    String(decodedToken!._id),
    req.params.deviceId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: "",
  });
});

// ─── PATCH /api/v1/users/me/devices/:deviceId/trust ──────────────
const trustDevice = catchAsync(async (req: Request, res: Response) => {
  const decodedToken = req.user as JwtPayload;
  const result = await UserServices.trustDevice(
    String(decodedToken!._id),
    req.params.deviceId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: "",
  });
});

// ─── ADMIN: GET /api/v1/users ─────────────────────────────────────
const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const {
    page = "1",
    limit = "20",
    status,
    kycStatus,
    role,
    search,
  } = req.query as {
    page?: string;
    limit?: string;
    status?: string;
    kycStatus?: string;
    role?: string;
    search?: string;
  };

  const { users, total } = await UserServices.getAllUsers({
    page: parseInt(String(page)),
    limit: parseInt(String(limit)),
    status: status as string | undefined,
    kycStatus: kycStatus as string | undefined,
    role: role as string | undefined,
    search: search as string | undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved.",
    data: users,
    meta: {
      page: parseInt(String(page)),
      limit: parseInt(String(limit)),
      totalPage: Math.ceil(total / parseInt(String(limit))),
      total,
    },
  });
});

// ─── ADMIN: PATCH /api/v1/users/:userId/status ───────────────────
const setUserStatus = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const { status } = req.body as {
    status: UserStatus.ACTIVE | UserStatus.SUSPENDED | UserStatus.BANNED;
  };
  const decodedToken = req.user as JwtPayload;
  const result = await UserServices.setUserStatus(
    userId,
    status,
    String(decodedToken!._id),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: "",
  });
});

// ─── ADMIN: KYC review ───────────────────────────────────────────
const reviewKyc = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const { action, rejectionReason } = req.body as {
    action: UserStatus.APPROVED | UserStatus.REJECTED;
    rejectionReason?: string;
  };
  const decodedToken = req.user as JwtPayload;
  const result = await UserServices.reviewKyc(
    userId,
    action,
    String(decodedToken!._id),
    rejectionReason,
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
  submitKyc,
  setup2FA,
  enable2FA,
  disable2FA,
  getDevices,
  removeDevice,
  trustDevice,
  getAllUsers,
  setUserStatus,
  reviewKyc,
};
