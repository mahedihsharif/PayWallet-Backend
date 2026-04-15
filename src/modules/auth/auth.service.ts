import bcrypt from "bcrypt";
import httpStatus from "http-status-codes";
import { env } from "../../config/env.config";
import AppError from "../../errorHelpers/AppError";
import { createUserTokens } from "../../utils/userTokens";
import { Wallet } from "../wallet/wallet.model";
import { User } from "./auth.model";
import { IAuthProvider, ILogin, IRegister } from "./auth.types";

const register = async (payload: Partial<IRegister>) => {
  const { email, password, phone, ...rest } = payload;
  const isUserExist = await User.findOne({ email });
  if (isUserExist) {
    throw new AppError(httpStatus.BAD_REQUEST, "User Already Exist!");
  }

  const hashed = await bcrypt.hash(
    password as string,
    Number(env.BCRYPT_SALT_ROUND),
  );

  const authProvider: IAuthProvider = {
    provider: "credentials",
    providerId: email as string,
  };

  const user = await User.create({
    email,
    password: hashed,
    phone,
    auths: [authProvider],
    ...rest,
  });
  // create wallet automatically
  await Wallet.create({
    userId: user._id,
  });
  return user;
};

const login = async (payload: ILogin) => {
  const { email, password } = payload;

  const isUserExist = await User.findOne({ email });

  if (!isUserExist) {
    throw new AppError(httpStatus.BAD_REQUEST, "User doesn't exist!");
  }

  const isPasswordMatched = await bcrypt.compare(
    password as string,
    isUserExist.password as string,
  );

  if (!isPasswordMatched) {
    throw new AppError(httpStatus.BAD_REQUEST, "Incorrect Password!");
  }

  const userTokens = createUserTokens(isUserExist);

  const { password: pass, ...rest } = isUserExist.toObject();

  return {
    accessToken: userTokens.accessToken,
    refreshToken: userTokens.refreshToken,
    user: rest,
  };
};

const setPassword = async (userId: string, plainPassword: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (
    user.password &&
    user.auths.some((providerObject) => providerObject.provider === "google")
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have already set you password. Now you can change the password from your profile password update",
    );
  }

  const hashedPassword = await bcrypt.hash(
    plainPassword,
    Number(env.BCRYPT_SALT_ROUND),
  );

  const credentialProvider: IAuthProvider = {
    provider: "credentials",
    providerId: user.email,
  };

  user.password = hashedPassword;
  user.auths = [...user.auths, credentialProvider] as any;
  await user.save();
};

export const AuthServices = { register, login, setPassword };
