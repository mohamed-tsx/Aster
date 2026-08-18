import express from "express";
import {
  listRolesCtrl,
  createRoleCtrl,
  updateRoleCtrl,
  deleteRoleCtrl,
} from "../../Controllers/Roles/rolesController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();

router.use(Verify);

router.get(
  "/",
  RequireAnyPermission(["VIEW_USERS", "CREATE_USERS", "UPDATE_USERS", "MANAGE_ROLES"]),
  listRolesCtrl,
);
router.post("/", RequirePermission("MANAGE_ROLES"), createRoleCtrl);
router.put("/:id", RequirePermission("MANAGE_ROLES"), updateRoleCtrl);
router.delete("/:id", RequirePermission("MANAGE_ROLES"), deleteRoleCtrl);

export default router;
