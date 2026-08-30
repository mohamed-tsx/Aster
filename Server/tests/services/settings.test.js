import { describe, it, expect } from "vitest";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { getSettings, updateSettings } from "../../Src/Services/Settings/settingsService.js";
import { createUser } from "../helpers/factories.js";

describe("settings service", () => {
  it("returns code defaults when nothing is stored", async () => {
    const settings = await getSettings();
    expect(settings.VISA_FEE_DEFAULT_DIRECT).toBe("400");
    expect(settings.VISA_FEE_DEFAULT_AGENCY).toBe("100");
  });

  it("stores an override and reflects it on the next read", async () => {
    const user = await createUser();
    const updated = await updateSettings({ VISA_FEE_DEFAULT_DIRECT: "450" }, user.id);
    expect(updated.VISA_FEE_DEFAULT_DIRECT).toBe("450");
    expect(updated.VISA_FEE_DEFAULT_AGENCY).toBe("100"); // untouched -> default

    const reread = await getSettings();
    expect(reread.VISA_FEE_DEFAULT_DIRECT).toBe("450");
  });

  it("rejects an unknown key", async () => {
    const user = await createUser();
    await expect(updateSettings({ NOPE: "1" }, user.id)).rejects.toThrow(AppError);
  });

  it("rejects a non-numeric or non-positive fee value", async () => {
    const user = await createUser();
    await expect(updateSettings({ VISA_FEE_DEFAULT_DIRECT: "abc" }, user.id)).rejects.toThrow(AppError);
    await expect(updateSettings({ VISA_FEE_DEFAULT_AGENCY: "0" }, user.id)).rejects.toThrow(AppError);
  });

  it("rejects a non-string/non-number value instead of coercing it", async () => {
    const user = await createUser();
    await expect(updateSettings({ VISA_FEE_DEFAULT_DIRECT: true }, user.id)).rejects.toMatchObject({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
    });
    await expect(updateSettings({ VISA_FEE_DEFAULT_DIRECT: [5] }, user.id)).rejects.toThrow(AppError);
    expect((await getSettings()).VISA_FEE_DEFAULT_DIRECT).toBe("400");
  });

  it("accepts zero and a positive value for EMBASSY_COMMISSION_DEFAULT", async () => {
    const user = await createUser();
    expect((await getSettings()).EMBASSY_COMMISSION_DEFAULT).toBe("0");

    const zeroed = await updateSettings({ EMBASSY_COMMISSION_DEFAULT: "0" }, user.id);
    expect(zeroed.EMBASSY_COMMISSION_DEFAULT).toBe("0");

    const fifty = await updateSettings({ EMBASSY_COMMISSION_DEFAULT: "50" }, user.id);
    expect(fifty.EMBASSY_COMMISSION_DEFAULT).toBe("50");
    expect((await getSettings()).EMBASSY_COMMISSION_DEFAULT).toBe("50");
  });

  it("still rejects a negative, blank or non-numeric EMBASSY_COMMISSION_DEFAULT", async () => {
    const user = await createUser();
    for (const bad of ["-5", "abc", "", "  "]) {
      await expect(updateSettings({ EMBASSY_COMMISSION_DEFAULT: bad }, user.id)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    expect((await getSettings()).EMBASSY_COMMISSION_DEFAULT).toBe("0");
  });

  it("still rejects zero for the visa-fee keys", async () => {
    const user = await createUser();
    await expect(updateSettings({ VISA_FEE_DEFAULT_DIRECT: "0" }, user.id)).rejects.toThrow(AppError);
    await expect(updateSettings({ VISA_FEE_DEFAULT_AGENCY: "0" }, user.id)).rejects.toThrow(AppError);
  });

  it("records the updating user", async () => {
    const user = await createUser();
    await updateSettings({ VISA_FEE_DEFAULT_AGENCY: "120" }, user.id);
    const { default: Prisma } = await import("../../Src/Config/Prisma/db.js");
    const row = await Prisma.appSetting.findUnique({ where: { key: "VISA_FEE_DEFAULT_AGENCY" } });
    expect(row.updatedById).toBe(user.id);
  });
});
