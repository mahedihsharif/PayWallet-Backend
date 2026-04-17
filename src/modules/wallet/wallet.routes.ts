import { Router } from "express";
import { WalletControllers } from "./wallet.controller";

const router = Router();

router.get(
  "/me",

  WalletControllers.myWallet,
);
router.get(
  "/balance",

  WalletControllers.myBalance,
);

router.patch(
  "/freeze/:userId",

  WalletControllers.freezeWallet,
);

router.patch(
  "/unfreeze/:userId",

  WalletControllers.unfreezeWallet,
);

export const WalletRoutes = router;
