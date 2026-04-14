import { Types } from "mongoose";

export type TTokenUser = {
  _id: Types.ObjectId;
  email: string;
  role: string;
};
