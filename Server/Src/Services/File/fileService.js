import fs from "fs/promises";
import path from "path";

/**
 * Delete a file from disk
 * @param {string} relativePath - Path relative to the server root (as stored in DB)
 */
export const deleteFile = async (relativePath) => {
  if (!relativePath || relativePath.startsWith("http")) return;

  try {
    // Handle absolute paths vs relative paths correctly
    const absolutePath = path.isAbsolute(relativePath)
      ? relativePath
      : path.join(process.cwd(), relativePath);

    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(`File not found for deletion: ${relativePath}`);
    } else {
      console.error(`Failed to delete file: ${relativePath}`, error);
    }
  }
};

/**
 * Update a record's file (deletes old, keeps new)
 * @param {string} oldPath
 * @param {string} newPath
 */
export const syncFile = async (oldPath, newPath) => {
  if (oldPath && oldPath !== newPath) {
    await deleteFile(oldPath);
  }
};
