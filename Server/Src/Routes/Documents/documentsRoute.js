import express from "express";
import { uploadDocumentCtrl, deleteDocumentCtrl } from "../../Controllers/Documents/documentsController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import { uploadDocument } from "../../Middlewares/Multer/uploadDocument.js";

// mergeParams: true so this router (mounted at "/api/v1/cases/:caseId/documents" in
// Server.js) can read req.params.caseId even though it's declared on the parent path.
const router = express.Router({ mergeParams: true });

router.use(Verify);

router.post(
  "/",
  RequirePermission("UPDATE_CASES"),
  uploadDocument.single("file"),
  uploadDocumentCtrl,
);
router.delete("/:id", RequirePermission("DELETE_CASES"), deleteDocumentCtrl);

export default router;
