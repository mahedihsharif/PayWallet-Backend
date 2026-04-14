import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { User } from "../modules/auth/auth.model";
import { verifyToken } from "../utils/jwt";

export const checkAuth =
  (...authRoles: string[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const accessToken = req.headers.authorization || req.cookies?.accessToken;

      if (!accessToken) {
        throw new AppError(httpStatus.FORBIDDEN, "No Token Found!");
      }

      const verifiedToken = verifyToken(
        accessToken,
        env.JWT_ACCESS_SECRET,
      ) as JwtPayload;

      if (!verifiedToken?.userId) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Token!");
      }

      const isUserExist = await User.findById(verifiedToken.userId);

      if (!isUserExist) {
        throw new AppError(httpStatus.BAD_REQUEST, "User doesn't exist!");
      }

      if (isUserExist.isBlocked) {
        throw new AppError(httpStatus.BAD_REQUEST, "User is Blocked!");
      }

      // role normalize (ADMIN vs admin bug fix)
      const userRole = (verifiedToken.role || "").toUpperCase();
      const allowedRoles = authRoles.map((r) => r.toUpperCase());

      if (!allowedRoles.includes(userRole)) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You are not permitted to view this route!",
        );
      }

      req.user = verifiedToken;

      next();
    } catch (err) {
      next(err);
    }
  };
