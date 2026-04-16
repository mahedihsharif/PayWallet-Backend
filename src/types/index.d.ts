import { IUser } from "../modules/user/user.model";
import { IWallet } from "../modules/wallet/wallet.model";

declare global {
  namespace Express {
    interface Request {
      user?: Pick<
        IUser,
        "_id" | "fullName" | "email" | "phone" | "role" | "status"
      >;
      wallet?: IWallet;
      requestId?: string; // Unique ID per request (for log correlation)
    }
  }
}
