import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

function extensionFromMimeType(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  return null;
}

async function removePreviousAvatarFiles(dir) {
  try {
    const files = await fs.readdir(dir);
    await Promise.all(
      files
        .filter((file) => file.startsWith("avatar."))
        .map((file) => fs.unlink(path.join(dir, file))),
    );
  } catch (_error) {
    // Ignore cleanup errors to avoid blocking uploads.
  }
}

export async function saveAvatarLocal(
  buffer,
  folder,
  avatarOwnerId,
  options = {},
) {
  const { preserveOriginal = false, mimeType = null } = options;
  const dir = path.join(process.cwd(), "uploads", folder, avatarOwnerId);
  await fs.mkdir(dir, { recursive: true });

  if (preserveOriginal) {
    const extension = extensionFromMimeType(mimeType) || "webp";
    const fileName = `avatar.${extension}`;
    const filePath = path.join(dir, fileName);

    await removePreviousAvatarFiles(dir);
    await fs.writeFile(filePath, buffer);

    return `/uploads/${folder}/${avatarOwnerId}/${fileName}`;
  }

  const fileName = "avatar.webp";
  const filePath = path.join(dir, fileName);

  await sharp(buffer)
    .rotate()
    .resize(512, 512, { fit: "cover" })
    .webp({ quality: 86 })
    .toFile(filePath);

  // Return the public URL that Express serves
  return `/uploads/${folder}/${avatarOwnerId}/${fileName}`;
}
