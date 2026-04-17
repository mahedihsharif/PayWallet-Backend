import env from "@config/env.config";
import { AuthTokens } from "@modules/auth/auth.types";
import { Response } from "express";

export const setAuthCookie = (res: Response, loginInfo: AuthTokens) => {
  if (loginInfo.accessToken) {
    res.cookie("accessToken", loginInfo.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "PRODUCTION",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: "/",
    });
  }

  if (loginInfo.refreshToken) {
    res.cookie("refreshToken", loginInfo.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "PRODUCTION",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/v1/auth/refresh", // Scoped path — sent ONLY to refresh endpoint
    });
  }
};
