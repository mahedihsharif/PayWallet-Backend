import { Schema, model } from "mongoose";
import { IAuthProvider, IRegister, Role } from "./auth.types";

const authProviderSchema = new Schema<IAuthProvider>(
  {
    provider: { type: String, required: true },
    providerId: { type: String, required: true },
  },
  { versionKey: false, _id: false },
);

const userSchema = new Schema<IRegister>(
  {
    name: { type: String, trim: true },

    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    auths: [authProviderSchema],
    phone: {
      type: String,
      unique: true,
      required: function (this: any) {
        return !this.auths?.some((a: IAuthProvider) => a.provider === "google");
      },
      trim: true,
    },

    password: {
      type: String,
      required: function (this: any) {
        return !this.auths?.some((a: IAuthProvider) => a.provider === "google");
      },
      trim: true,
    },

    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.USER,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    transactionPin: String,
  },
  { timestamps: true, versionKey: false },
);

export const User = model("User", userSchema);
