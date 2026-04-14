import { Schema, model } from "mongoose";
import { Status } from "./wallet.types";

const walletSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    balance: {
      type: Number,
      default: 0,
    },

    currency: {
      type: String,
      default: "BDT",
    },

    status: {
      type: Object.values(Status),
      default: Status.ACTIVE,
    },
  },
  { timestamps: true },
);

export const Wallet = model("Wallet", walletSchema);
