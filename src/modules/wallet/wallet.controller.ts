import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { WalletServices } from "./wallet.service";

const myWallet = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const decodedToken = req.user as JwtPayload;
    const result = await WalletServices.myWallet(decodedToken.userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "",
      data: result.data,
    });
  },
);

const myBalance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const decodedToken = req.user as JwtPayload;
    const result = await WalletServices.myBalance(decodedToken.userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "",
      data: result.data,
    });
  },
);

const freezeWallet = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await WalletServices.freezeWallet(
      req.params.userId as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "",
      data: result.data,
    });
  },
);

const unfreezeWallet = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await WalletServices.unfreezeWallet(
      req.params.userId as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "",
      data: result.data,
    });
  },
);

export const WalletControllers = {
  myWallet,
  myBalance,
  freezeWallet,
  unfreezeWallet,
};
