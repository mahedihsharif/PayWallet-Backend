import { NextFunction, Request, Response, Router } from "express";
import httpStatus from "http-status-codes";
import passport from "passport";
import env from "../../config/env.config";
import { isGoogleOAuthConfigured } from "../../config/passport.config";
import AppError from "../../errorHelpers/AppError";
import { checkAuth } from "../../middlewares/checkAuth";
import validateRequest from "../../middlewares/validateRequest";
import { AuthControllers } from "./auth.controller";
import { Role } from "./auth.types";
import { loginSchema, registerSchema } from "./auth.validation";

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
router.post("/login", validateRequest(loginSchema), AuthControllers.login);
router.post(
  "/set-password",
  checkAuth(...Object.values(Role)),
  AuthControllers.setPassword,
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
