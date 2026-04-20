import { OtpPurpose } from "@modules/otp/otp.types";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import env from "../../config/env.config";
import AppError from "../../errorHelpers/AppError";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { setAuthCookie } from "../../utils/setCookie";
import { createUserTokens } from "../../utils/userTokens";
import { AuthServices } from "./auth.service";
import {
  AuthTokens,
  ForgotPasswordDTO,
  LoginDTO,
  RegisterDTO,
  ResetPasswordDTO,
} from "./auth.types";

const register = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await AuthServices.register(req.body as RegisterDTO);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message:
        "Registration successful. Please check your email for a verification code.",
      data: result,
    });
  },
);

const verifyEmail = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, code } = req.body as { email: string; code: string };
    const result = await AuthServices.verifyEmail(email, code);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Email verified successfully!",
      data: result,
    });
  },
);

const login = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const dto = req.body as LoginDTO;
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const result = await AuthServices.login(dto, ipAddress);
    setAuthCookie(res, result.tokens);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User Login Successfully!",
      data: result,
    });
  },
);

const refreshToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new AppError(httpStatus.BAD_REQUEST, "No refresh token received!");
    }

    const tokenInfo: AuthTokens = await AuthServices.refreshToken(
      refreshToken as string,
    );
    setAuthCookie(res, tokenInfo);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "New Access Token Retrieved Successfully!",
      data: tokenInfo,
    });
  },
);

//google credential
const googleCallBack = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    let redirectTo = req.query.state ? (req.query.state as string) : "";

    if (redirectTo.startsWith("/")) {
      redirectTo = redirectTo.slice(1);
    }

    const user = req.user;

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, "User Not Found!");
    }

    const tokenInfo = await createUserTokens(user);
    setAuthCookie(res, tokenInfo);
    res.redirect(`${env.FRONTEND_URL}/${redirectTo}`);
  },
);

const setPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const decodedToken = req.user as JwtPayload;
    const { password } = req.body;
    await AuthServices.setPassword(decodedToken._id, password);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Password Set Successfully!",
      data: null,
    });
  },
);

const forgotPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body as ForgotPasswordDTO;
    const result = await AuthServices.forgotPassword(email);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: result.message,
      data: null,
    });
  },
);

const resetPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, code, newPassword } = req.body as ResetPasswordDTO;
    const result = await AuthServices.resetPassword(email, code, newPassword);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: result.message,
      data: null,
    });
  },
);

const resendOtp = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, purpose } = req.body as {
      email: string;
      purpose: OtpPurpose.EMAIL_VERIFY | OtpPurpose.PASSWORD_RESET;
    };
    const result = await AuthServices.resendOtp(email, purpose);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: result.message,
      data: null,
    });
  },
);

const logout = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const accessToken =
      req.cookies?.accessToken ?? req.headers.authorization?.split(" ")[1];
    const refreshToken = req.cookies?.refreshToken;
    if (accessToken) {
      await AuthServices.logout(
        accessToken,
        refreshToken,
        String(req.user!._id),
      );
    }
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/api/v1/auth/refresh",
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User Logout Successfully!",
      data: null,
    });
  },
);

// ─── POST /api/v1/auth/logout-all ────────────────────────────────

const logoutAll = catchAsync(async (req: Request, res: Response) => {
  const accessToken =
    req.cookies?.accessToken ?? req.headers.authorization?.split(" ")[1];

  if (accessToken) {
    await AuthServices.logoutAllDevices(accessToken, String(req.user!._id));
  }

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/api/v1/auth/refresh",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out of all devices successfully.",
    data: null,
  });
});

export const AuthControllers = {
  register,
  login,
  forgotPassword,
  resetPassword,
  resendOtp,
  refreshToken,
  googleCallBack,
  logout,
  logoutAll,
  setPassword,
  verifyEmail,
};
