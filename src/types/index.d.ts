import { IUser } from "../modules/user/user.types";
import { IWallet } from "../modules/wallet/wallet.types";

declare global {
  namespace Express {
    /** Populated by `checkAuth` and Passport strategies — must match runtime shape. */
    interface User
      extends Pick<
        IUser,
        "_id" | "fullName" | "email" | "phone" | "role" | "status"
      > {}

    interface Request {
      wallet?: IWallet;
      requestId?: string; // Unique ID per request (for log correlation)
    }
  }
}
