import express from "express";
import {
  listUsersCtrl,
  getUserCtrl,
  createUserCtrl,
  updateUserCtrl,
  deleteUserCtrl,
} from "../../Controllers/Users/usersController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";

const router = express.Router();

// All user-management routes require authentication
router.use(Verify);

router.get("/", RequirePermission("VIEW_USERS"), listUsersCtrl);
router.get("/:id", RequirePermission("VIEW_USERS"), getUserCtrl);
router.post("/", RequirePermission("CREATE_USERS"), createUserCtrl);
router.put("/:id", RequirePermission("UPDATE_USERS"), updateUserCtrl);
router.delete("/:id", RequirePermission("DELETE_USERS"), deleteUserCtrl);

export default router;
