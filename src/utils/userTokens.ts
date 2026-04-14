import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import AppError from "../errorHelpers/AppError";
import { User } from "../modules/auth/auth.model";
import { IRegister } from "../modules/auth/auth.types";
import { env } from "./../config/env";
import { generateToken, verifyToken } from "./jwt";

export const createUserTokens = (user: Partial<IRegister>) => {
  const { _id, email, role } = user;
  const jwtPayload = {
    userId: _id,
    email: email,
    role: role,
  };

  const accessToken = generateToken(
    jwtPayload,
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_EXPIRES,
  );

  const refreshToken = generateToken(
    jwtPayload,
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_EXPIRES,
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
    env.JWT_ACCESS_EXPIRES,
  );
  return accessToken;
};
