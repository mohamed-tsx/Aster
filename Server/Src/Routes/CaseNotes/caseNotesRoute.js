import express from "express";
import { listCaseNotesCtrl, createCaseNoteCtrl } from "../../Controllers/CaseNotes/caseNotesController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";

// mergeParams: true so this router (mounted at "/api/v1/cases/:caseId/notes" in
// Server.js) can read req.params.caseId even though it's declared on the parent path.
const router = express.Router({ mergeParams: true });

router.use(Verify);

router.get("/", RequirePermission("VIEW_CASES"), listCaseNotesCtrl);
router.post("/", RequirePermission("UPDATE_CASES"), createCaseNoteCtrl);

export default router;
