import redis from "@config/redis.config";
import crypto from "crypto";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import env from "../config/env.config";
import AppError from "../errorHelpers/AppError";
import { User } from "../modules/auth/auth.model";
import { AuthUser } from "../modules/auth/auth.types";
import { CONSTANTS } from "./constants";
import { generateToken, verifyToken } from "./jwt";

export const createUserTokens = async (user: Partial<AuthUser>) => {
  const { _id, email, role } = user;
  const jwtPayload = {
    userId: _id,
    email: email,
    role: role,
  };
  const jti = crypto.randomUUID();
  const accessToken = generateToken(
    jwtPayload,
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_EXPIRES_IN,
  );

  const refreshToken = generateToken(
    jwtPayload,
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_EXPIRES_IN,
  );

  // Store refresh token in Redis with TTL
  await redis.setex(
    CONSTANTS.REDIS_KEYS.REFRESH_TOKEN(_id as string, jti),
    CONSTANTS.REFRESH_TOKEN_TTL,
    JSON.stringify({ userId: _id, createdAt: Date.now() }),
  );

  return {
    accessToken,
    refreshToken,
  };
};

export const createNewAccessTokenWithRefreshToken = async (
  refreshToken: string,
) => {
  const verifiedRefreshToken = verifyToken(
    refreshToken,
    env.JWT_REFRESH_SECRET!,
  ) as JwtPayload;

  const isUserExist = await User.findOne({ email: verifiedRefreshToken.email });
  if (!isUserExist) {
    throw new AppError(httpStatus.BAD_REQUEST, "User doesn't exist!");
  }

  //   if (isUserExist) {
  //     if (
  //       isUserExist.isActive === IsActive.BLOCKED ||
  //       isUserExist.isActive === IsActive.INACTIVE
  //     )
  //       throw new AppError(
  //         httpStatus.BAD_REQUEST,
  //         `User is ${isUserExist.isActive}`,
  //       );
  //     if (isUserExist.isDeleted) {
  //       throw new AppError(httpStatus.BAD_REQUEST, "User is Deleted!");
  //     }
  //   }

  const jwtPayload = {
    userId: isUserExist._id,
    email: isUserExist.email,
    role: isUserExist.role,
  };

  const accessToken = generateToken(
    jwtPayload,
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_EXPIRES_IN,
  );
  return accessToken;
};
