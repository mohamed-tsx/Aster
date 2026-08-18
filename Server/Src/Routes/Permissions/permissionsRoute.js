import express from "express";
import {
  listPermissionsCtrl,
  createPermissionCtrl,
  updatePermissionCtrl,
  deletePermissionCtrl,
} from "../../Controllers/Permissions/permissionsController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";

const router = express.Router();

router.use(Verify);
router.use(RequirePermission("MANAGE_ROLES"));

router.get("/", listPermissionsCtrl);
router.post("/", createPermissionCtrl);
router.put("/:id", updatePermissionCtrl);
router.delete("/:id", deletePermissionCtrl);

export default router;
