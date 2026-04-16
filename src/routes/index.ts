import env from "@config/env.config";
import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.routes";
import { UserRoutes } from "../modules/user/user.routes";
import { WalletRoutes } from "../modules/wallet/wallet.routes";

export const router = Router();

// ─── Health check — always the first route ────────────────────────
router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "PayWallet API is running",
    data: {
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      version: "v1",
    },
    meta: null,
  });
});

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/user",
    route: UserRoutes,
  },
  {
    path: "/wallet",
    route: WalletRoutes,
  },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});
