import path from "path";

/** Base dir for on-disk document storage. Overridable so tests never touch dev uploads. */
export const uploadRoot = () => process.env.UPLOAD_ROOT || process.cwd();

export const documentsDir = () => path.join(uploadRoot(), "uploads", "documents");
