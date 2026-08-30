import { describe, it, expect } from "vitest";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { createHospital, updateHospital } from "../../Src/Services/Hospitals/hospitalsService.js";

describe("createHospital — country", () => {
  it("rejects a missing country", async () => {
    await expect(
      createHospital({ name: "Apollo", city: "Chennai" }),
    ).rejects.toThrow("Country is required");
  });

  it("stores a trimmed country and lets it be updated", async () => {
    const h = await createHospital({ name: `H ${Date.now()}`, city: "Chennai", country: "  India  " });
    expect(h.country).toBe("India");
    const u = await updateHospital(h.id, { country: "UAE" });
    expect(u.country).toBe("UAE");
  });
});
