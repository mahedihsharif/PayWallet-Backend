import { Types } from "mongoose";

export interface IRegister {
  _id?: Types.ObjectId;
  name?: string;
  email: string;
  phone?: string;
  password?: string;
  role: Role;
  auths: IAuthProvider[];
  isBlocked?: boolean;
  transactionPin?: string;
}

export interface ILogin {
  email: string;
  password: string;
}

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
}

export interface IAuthProvider {
  provider: "google" | "credentials";
  providerId: string;
}
