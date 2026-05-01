import { multerUpload } from "@config/multer.config";
import { auditLog } from "@middlewares/auditLogger.middleware";
import { checkAuth } from "@middlewares/checkAuth";
import validateRequest from "@middlewares/validateRequest";
import { Router } from "express";
import Joi from "joi";
import { UserControllers } from "./user.controller";
import { Role, UserStatus } from "./user.types";
import {
  changePinSchema,
  enable2FASchema,
  reviewKycSchema,
  setPinSchema,
  submitKycSchema,
  updateProfileSchema,
  verify2FASchema,
} from "./user.validation";

const auth = checkAuth();
const checkAdmin = checkAuth(Role.ADMIN, Role.SUPER_ADMIN);
const router = Router();

// ─── Profile ──────────────────────────────────────────────────────
router.get("/me", auth, UserControllers.getProfile);
router.patch(
  "/me",
  auth,
  validateRequest(updateProfileSchema),
  UserControllers.updateProfile,
);
router.post(
  "/me/avatar",
  auth,
  multerUpload.single("file"),
  UserControllers.uploadAvatar,
);
router.delete("/me", auth, UserControllers.requestAccountDeletion);

// ─── PIN ──────────────────────────────────────────────────────────
router.post(
  "/me/pin/set",
  auth,
  validateRequest(setPinSchema),
  auditLog("PIN_CHANGED", "User"),
  UserControllers.setPin,
);
router.patch(
  "/me/pin/change",
  auth,
  validateRequest(changePinSchema),
  auditLog("PIN_CHANGED", "User"),
  UserControllers.changePin,
);

// ─── KYC ──────────────────────────────────────────────────────────
router.post(
  "/me/kyc",
  auth,
  validateRequest(submitKycSchema),
  UserControllers.submitKyc,
);

// ─── 2FA ──────────────────────────────────────────────────────────
router.post(
  "/me/2fa/setup",
  auth,
  auditLog("TWO_FACTOR_ENABLED", "User"),
  UserControllers.setup2FA,
);
router.post(
  "/me/2fa/enable",
  auth,
  validateRequest(enable2FASchema),
  UserControllers.enable2FA,
);
router.post(
  "/me/2fa/disable",
  auth,
  validateRequest(verify2FASchema),
  UserControllers.disable2FA,
);

// ─── Devices ──────────────────────────────────────────────────────
router.get("/me/devices", auth, UserControllers.getDevices);
router.delete("/me/devices/:deviceId", auth, UserControllers.removeDevice);
router.patch("/me/devices/:deviceId/trust", auth, UserControllers.trustDevice);

// ─── Admin routes ─────────────────────────────────────────────────
router.get("/", checkAdmin, UserControllers.getAllUsers);

router.patch(
  "/:userId/status",
  checkAdmin,
  validateRequest(
    Joi.object({
      status: Joi.string()
        .valid(UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.BANNED)
        .required(),
    }),
  ),
  auditLog("USER_BANNED", "User"),
  UserControllers.setUserStatus,
);

router.patch(
  "/:userId/kyc/review",
  checkAdmin,
  validateRequest(reviewKycSchema),
  auditLog("KYC_APPROVED", "User"),
  UserControllers.reviewKyc,
);

export const UserRoutes = router;
