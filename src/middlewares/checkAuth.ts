import redis from "@config/redis.config";
import { CONSTANTS } from "@utils/constants";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import env from "../config/env.config";
import AppError from "../errorHelpers/AppError";
import { User } from "../modules/auth/auth.model";
import { verifyToken } from "../utils/jwt";

export const checkAuth =
  (...authRoles: string[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // ─── 1. Extract token from cookie or Authorization header ─────
      let token: string | undefined;

      if (req.cookies?.accessToken) {
        token = req.cookies.accessToken;
      } else if (req.headers.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
      }

      if (!token) {
        throw new AppError(httpStatus.FORBIDDEN, "No Token Found!");
      }

      // ─── 2. Check if token is blacklisted (logged out) ────────────
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const isBlacklisted = await redis.exists(
        CONSTANTS.REDIS_KEYS.BLACKLIST(tokenHash),
      );

      if (isBlacklisted) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Token has been invalidated. Please log in again.",
        );
      }

      const verifiedToken = verifyToken(
        token,
        env.JWT_ACCESS_SECRET,
      ) as JwtPayload;

      if (!verifiedToken || !verifiedToken.userId) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Token!");
      }

      const isUserExist = await User.findById(verifiedToken.userId).select(
        "_id fullName email phone role status",
      );

      if (!isUserExist) {
        throw new AppError(httpStatus.BAD_REQUEST, "User doesn't exist!");
      }
      // if (isUserExist.status !== "active") {
      //   throw new AppError(
      //     httpStatus.BAD_REQUEST,
      //     `Account is ${isUserExist.status}. Contact support.`,
      //   );
      // }
      if (isUserExist.isBlocked) {
        throw new AppError(httpStatus.BAD_REQUEST, "User is Blocked!");
      }

      // role normalize (ADMIN vs admin bug fix)
      const userRole = (verifiedToken.role || "").toUpperCase();
      const allowedRoles = authRoles.map((r) => r.toUpperCase());

      if (!allowedRoles.includes(userRole)) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `Role '${userRole}' is not authorized for this action.`,
        );
      }

      req.user = isUserExist;

      next();
    } catch (err) {
      next(err);
    }
  };
