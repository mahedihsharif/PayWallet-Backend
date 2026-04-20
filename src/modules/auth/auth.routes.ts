import { checkAuth } from "@middlewares/checkAuth";
import { Role } from "@modules/user/user.types";
import { NextFunction, Request, Response, Router } from "express";
import httpStatus from "http-status-codes";
import passport from "passport";
import env from "../../config/env.config";
import { isGoogleOAuthConfigured } from "../../config/passport.config";
import AppError from "../../errorHelpers/AppError";
import validateRequest from "../../middlewares/validateRequest";
import { AuthControllers } from "./auth.controller";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.validation";

const router = Router();
const ensureGoogleOAuthConfigured = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!isGoogleOAuthConfigured) {
    return next(
      new AppError(
        httpStatus.SERVICE_UNAVAILABLE,
        "Google login is not configured on this server.",
      ),
    );
  }
  return next();
};

router.post(
  "/register",
  validateRequest(registerSchema),
  AuthControllers.register,
);
router.post(
  "/verify-email",
  validateRequest(verifyEmailSchema),
  AuthControllers.verifyEmail,
);
router.post("/login", validateRequest(loginSchema), AuthControllers.login);

router.post("/refresh", AuthControllers.refreshToken);

router.post(
  "/set-password",
  checkAuth(...Object.values(Role)),
  AuthControllers.setPassword,
);

router.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  AuthControllers.forgotPassword,
);

router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  AuthControllers.resetPassword,
);

router.post(
  "/resend-otp",
  validateRequest(resendOtpSchema),
  AuthControllers.resendOtp,
);

// ─── Protected routes (authentication required) ───────────────────

router.post(
  "/logout",
  checkAuth(...Object.values(Role)),
  AuthControllers.logout,
);

router.post(
  "/logout-all",
  checkAuth(...Object.values(Role)),
  AuthControllers.logoutAll,
);

router.get(
  "/google",
  ensureGoogleOAuthConfigured,
  async (req: Request, res: Response, next: NextFunction) => {
    const redirect = req.query.redirect || "";
    passport.authenticate("google", {
      scope: ["profile", "email"],
      state: redirect as string,
    })(req, res, next);
  },
);
router.get(
  "/google/callback",
  ensureGoogleOAuthConfigured,
  passport.authenticate("google", {
    failureRedirect: `${env.FRONTEND_URL}/login?error=There are some issues with your account, please contact our support system`,
  }),
  AuthControllers.googleCallBack,
);

export const AuthRoutes = router;
