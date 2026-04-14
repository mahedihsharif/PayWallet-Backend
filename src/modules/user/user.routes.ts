import { Router } from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../auth/auth.types";
import { UserControllers } from "./user.controller";

const router = Router();

router.get("/me", checkAuth(...Object.values(Role)), UserControllers.getMe);
// router.get(
//   "/dashboard",
//   checkAuth(...Object.values(Role.ADMIN)),
//   UserControllers.getMe,
// );

export const UserRoutes = router;
