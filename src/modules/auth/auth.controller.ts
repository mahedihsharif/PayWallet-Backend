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
import { LoginDTO, RegisterDTO } from "./auth.types";

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

const logout = catchAsync(
  async (_req: Request, res: Response, _next: NextFunction) => {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User Logout Successfully!",
      data: null,
    });
  },
);

const setPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const decodedToken = req.user as JwtPayload;
    const { password } = req.body;
    await AuthServices.setPassword(decodedToken.userId, password);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Password Set Successfully!",
      data: null,
    });
  },
);

export const AuthControllers = {
  register,
  login,
  googleCallBack,
  logout,
  setPassword,
  verifyEmail,
};
