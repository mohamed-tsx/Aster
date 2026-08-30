import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

export const SETTING_DEFAULTS = {
  VISA_FEE_DEFAULT_DIRECT: "400",
  VISA_FEE_DEFAULT_AGENCY: "100",
  EMBASSY_COMMISSION_DEFAULT: "0",
};

export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS);

// Settings whose value may legitimately be zero. The embassy commission defaults
// to "0" (no partnership), so a strictly-positive guard would make the seeded
// default unsettable. Everything else is a strictly-positive-number string; if a
// non-numeric setting is ever added, branch here on the key.
const ZERO_ALLOWED_KEYS = ["EMBASSY_COMMISSION_DEFAULT"];

const assertValidValue = (key, value) => {
  const allowsZero = ZERO_ALLOWED_KEYS.includes(key);
  const wording = allowsZero ? "zero or a positive number" : "a positive number";
  // `Number("")` and `Number(" ")` are both 0, so a blank string would sneak
  // through the zero-allowed branch — reject it up front.
  if ((typeof value !== "string" && typeof value !== "number") || (typeof value === "string" && value.trim() === "")) {
    throw new AppError(`${key} must be ${wording}`, 400, "VALIDATION_ERROR");
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (!allowsZero && n <= 0)) {
    throw new AppError(`${key} must be ${wording}`, 400, "VALIDATION_ERROR");
  }
};

export const getSettings = async () => {
  const rows = await Prisma.appSetting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...SETTING_DEFAULTS, ...stored };
};

/**
 * @param {Record<string,string>} patch
 * @param {string} userId
 */
export const updateSettings = async (patch, userId) => {
  const entries = Object.entries(patch ?? {});
  if (entries.length === 0) {
    throw new AppError("No settings supplied", 400, "VALIDATION_ERROR");
  }
  for (const [key, value] of entries) {
    if (!SETTING_KEYS.includes(key)) {
      throw new AppError(`Unknown setting: ${key}`, 400, "VALIDATION_ERROR");
    }
    assertValidValue(key, value);
  }

  await Prisma.$transaction(
    entries.map(([key, value]) =>
      Prisma.appSetting.upsert({
        where: { key },
        create: { key, value: String(value), updatedById: userId },
        update: { value: String(value), updatedById: userId },
      }),
    ),
  );

  return getSettings();
};
