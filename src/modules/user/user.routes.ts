import { multerUpload } from "@config/multer.config";
import { checkAuth } from "@middlewares/checkAuth";
import validateRequest from "@middlewares/validateRequest";
import { Router } from "express";
import { UserControllers } from "./user.controller";
import { Role } from "./user.types";
import { updateProfileSchema } from "./user.validation";

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

export const UserRoutes = router;
