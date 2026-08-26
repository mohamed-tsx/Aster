import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { getExpiringPassports } from "../../Src/Services/Dashboard/dashboardService.js";
import { createCase, createPatient } from "../helpers/factories.js";

const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

describe("getExpiringPassports", () => {
  it("lists patients whose passport expires within the given window", async () => {
    const soonPatient = await createPatient({ passportExpiry: daysFromNow(30) });
    await createCase({ patientId: soonPatient.id });

    const farPatient = await createPatient({ passportExpiry: daysFromNow(400) });
    await createCase({ patientId: farPatient.id });

    const results = await getExpiringPassports(90);

    const patientIds = results.map((r) => r.travelerId);
    expect(patientIds).toContain(soonPatient.id);
    expect(patientIds).not.toContain(farPatient.id);
  });

  it("excludes already-expired passports", async () => {
    const expiredPatient = await createPatient({ passportExpiry: daysFromNow(-10) });
    await createCase({ patientId: expiredPatient.id });

    const results = await getExpiringPassports(90);

    expect(results.map((r) => r.travelerId)).not.toContain(expiredPatient.id);
  });

  it("excludes cancelled and completed cases", async () => {
    const patient = await createPatient({ passportExpiry: daysFromNow(30) });
    const kase = await createCase({ patientId: patient.id, status: "CANCELLED" });

    const results = await getExpiringPassports(90);

    expect(results.map((r) => r.caseId)).not.toContain(kase.id);
  });
});
