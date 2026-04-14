import { Router } from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../auth/auth.types";
import { WalletControllers } from "./wallet.controller";

const router = Router();

router.get(
  "/me",
  checkAuth(...Object.values(Role)),
  WalletControllers.myWallet,
);
router.get(
  "/balance",
  checkAuth(...Object.values(Role)),
  WalletControllers.myBalance,
);

router.patch(
  "/freeze/:userId",
  checkAuth(Role.ADMIN),
  WalletControllers.freezeWallet,
);

router.patch(
  "/unfreeze/:userId",
  checkAuth(Role.ADMIN),
  WalletControllers.unfreezeWallet,
);

export const WalletRoutes = router;
