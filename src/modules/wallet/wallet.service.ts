import { Wallet } from "./wallet.model";
import { Status } from "./wallet.types";

const myWallet = async (userId: string) => {
  const wallet = await Wallet.findOne({ userId });
  return {
    data: wallet,
  };
};

const myBalance = async (userId: string) => {
  const wallet = await Wallet.findOne({ userId });
  return {
    data: wallet?.balance || 0,
  };
};

const freezeWallet = async (userId: string) => {
  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { status: Status.FROZEN },
    { new: true },
  );
  return {
    data: wallet,
  };
};

const unfreezeWallet = async (userId: string) => {
  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { status: Status.ACTIVE },
    { new: true },
  );
  return {
    data: wallet,
  };
};

export const WalletServices = {
  myWallet,
  myBalance,
  freezeWallet,
  unfreezeWallet,
};
