import { Router } from "express";
import { UserControllers } from "./user.controller";

const router = Router();

router.get("/me", UserControllers.getMe);
// router.get(
//   "/dashboard",
//   checkAuth(...Object.values(Role.ADMIN)),
//   UserControllers.getMe,
// );

export const UserRoutes = router;
