/**
 * Builds one demo Case and its entire object graph (patient, attendant,
 * inquiries, documents, visa applications, payments, expenses, events, notes,
 * and any case-linked revenue) up to a target lifecycle status.
 *
 * Timestamps are backdated so the dashboard, timelines and charts have history.
 */

import crypto from "crypto";
import { saveDocumentLocal } from "../../../Src/Utils/Documents/saveDocumentLocal.js";
import {
  passportImage,
  letterImage,
  visaCopyImage,
  scanImage,
} from "./docImages.js";
import {
  rand, int, chance, pick, pickN, weighted, money, addDays, addMonths, notAfter,
} from "./rng.js";
import * as somali from "./somali.js";
import {
  SPECIALTIES, CASE_EXPENSE_CATEGORIES, CASE_NOTE_SNIPPETS, MEDICAL_CONDITIONS,
} from "./catalog.js";

const NOW = new Date();
const CURRENCY_USD = "USD";

/** Cost bands (USD) keyed loosely by condition keyword. */
function estimateCost(condition) {
  const c = condition.toLowerCase();
  if (c.includes("transplant") || c.includes("marrow")) return money(28000, 65000, 500);
  if (c.includes("cardiac") || c.includes("valve") || c.includes("cabg") || c.includes("bypass")) return money(9000, 22000, 250);
  if (c.includes("carcinoma") || c.includes("oncolog") || c.includes("chemo") || c.includes("radiotherapy")) return money(7000, 28000, 250);
  if (c.includes("neuro") || c.includes("brain") || c.includes("spine")) return money(8000, 24000, 250);
  if (c.includes("replacement") || c.includes("bariatric")) return money(6000, 14000, 250);
  if (c.includes("ivf") || c.includes("infertil")) return money(3500, 7000, 100);
  if (c.includes("cataract") || c.includes("retina") || c.includes("thyroid")) return money(2500, 6500, 100);
  return money(4000, 12000, 250);
}

function makePerson(gender) {
  const n = somali.fullName(gender);
  return {
    firstName: n.firstName,
    lastName: n.lastName,
    gender,
    dateOfBirth: null, // set by caller (patient vs child)
    nationality: somali.NATIONALITY,
    passportNumber: somali.passportNumber(),
    phone: somali.somaliPhone(),
  };
}

export async function buildCase(ctx, targetStatus, caseNumber, createdAtInput) {
  const { prisma } = ctx;
  const officer = pick(ctx.caseStaff);
  const financeUser = pick(ctx.financeStaff);
  const manager = pick(ctx.managers);

  // CANCELLED cases are built up to a random real stage and then cancelled.
  const cancelling = targetStatus === "CANCELLED";
  const stopAt = cancelling
    ? weighted([["HOSPITAL_MATCHING", 28], ["HOSPITAL_ACCEPTED", 34], ["VISA_PROCESSING", 38]])
    : targetStatus;

  const reachOutType = weighted([["DIRECT", 55], ["AGENCY", 45]]);
  const agency = reachOutType === "AGENCY" ? pick(ctx.agencies) : null;

  // ---- patient ----
  const isChild = chance(0.08);
  const gender = weighted([["MALE", 52], ["FEMALE", 46], ["OTHER", 2]]);
  const condition = isChild
    ? "Congenital heart defect (VSD) — pediatric cardiac surgery"
    : pick(MEDICAL_CONDITIONS);
  const p = makePerson(gender);
  const now = NOW.getTime();
  p.dateOfBirth = isChild
    ? new Date(now - int(1, 14) * 365 * 86_400_000)
    : new Date(now - int(19, 74) * 365 * 86_400_000);
  // ~7% of active-case passports expire within 90 days (feeds the dashboard widget)
  p.passportExpiry = chance(0.07)
    ? addDays(NOW, int(10, 88))
    : new Date(now + int(200, 2600) * 86_400_000);
  p.email = chance(0.35) ? somali.emailFor(p.firstName, p.lastName, "gmail.com") : null;
  p.address = somali.streetAddress();

  const createdAt = createdAtInput ?? new Date(now - int(4, 330) * 86_400_000);

  const patient = await prisma.patient.create({ data: { ...p, createdAt } });

  // ---- case ----
  const kase = await prisma.case.create({
    data: {
      caseNumber,
      reachOutType,
      status: "NEW",
      patientId: patient.id,
      agencyId: agency?.id ?? null,
      assignedToId: officer.id,
      notes: chance(0.7) ? `${condition}. Referred for specialist evaluation abroad.` : null,
      createdAt,
    },
  });

  const events = [];
  const notes = [];
  const pushEvent = (type, toStatus, at, extra = {}) =>
    events.push({
      caseId: kase.id, type, toStatus, actorId: (extra.actor ?? officer).id,
      fromStatus: extra.fromStatus ?? null,
      visaApplicationId: extra.visaApplicationId ?? null,
      inquiryId: extra.inquiryId ?? null,
      createdAt: notAfter(at, NOW),
    });
  const pushNote = (body, at, author = officer) =>
    notes.push({ caseId: kase.id, body, authorId: author.id, createdAt: notAfter(at, NOW) });

  async function cancelHere(fromStatus, at) {
    // mirror the real cancelCase: close any still-pending inquiries
    await prisma.hospitalInquiry.updateMany({
      where: { caseId: kase.id, status: "PENDING" },
      data: { status: "DECLINED", respondedAt: notAfter(at, NOW) },
    });
    await prisma.case.update({ where: { id: kase.id }, data: { status: "CANCELLED" } });
    pushEvent("CASE_STATUS_CHANGED", "CANCELLED", at, { fromStatus });
    pushNote(
      pick([
        "Case cancelled — family decided to seek treatment locally.",
        "Cancelled — funding fell through.",
        "Cancelled at the family's request.",
        "Patient's condition changed; overseas referral no longer appropriate.",
      ]),
      at,
      manager,
    );
    await flush();
    return { status: "CANCELLED", kase, chosenInquiry: null, treatmentCost: null };
  }

  pushEvent("CASE_CREATED", "NEW", createdAt);
  if (chance(0.55)) {
    pushNote(
      pick(CASE_NOTE_SNIPPETS).replace("{relation}", (somali.RELATIONS[int(0, 5)] || "relative").toLowerCase()),
      addDays(createdAt, rand() * 3),
    );
  }

  // ---- attendant ----
  let attendant = null;
  const wantsAttendant = chance(0.42) || isChild;
  if (wantsAttendant) {
    const ag = weighted([["MALE", 50], ["FEMALE", 50]]);
    const ap = makePerson(ag);
    ap.dateOfBirth = new Date(now - int(24, 60) * 365 * 86_400_000);
    ap.passportExpiry = new Date(now + int(200, 2400) * 86_400_000);
    ap.relationToPatient = isChild ? pick(["Mother", "Father", "Guardian"]) : pick(somali.RELATIONS);
    delete ap.email;
    attendant = await prisma.attendant.create({
      data: { ...ap, caseId: kase.id, createdAt: addDays(createdAt, rand() * 2) },
    });
  }

  // ---- documents helper ----
  const docCreatedFor = officer;
  async function addDoc(type, imageResult, at, hospitalInquiryId = null) {
    const id = crypto.randomUUID();
    const fileUrl = await saveDocumentLocal(imageResult.buffer, kase.id, id, imageResult.mimeType);
    return prisma.document.create({
      data: {
        id, caseId: kase.id, type, fileUrl, fileName: imageResult.fileName,
        hospitalInquiryId, uploadedById: docCreatedFor.id, createdAt: notAfter(at, NOW),
      },
    });
  }

  // patient passport + referral form (+ attendant passport) always exist
  await addDoc("PATIENT_PASSPORT", await passportImage(patient), addDays(createdAt, rand()));
  await addDoc(
    "CASE_DOCUMENT",
    await scanImage({
      title: "PATIENT REFERRAL FORM",
      caseNumber,
      fields: [
        ["Patient name", `${patient.firstName} ${patient.lastName}`],
        ["Date of birth", patient.dateOfBirth.toLocaleDateString("en-GB")],
        ["Nationality", "Somali"],
        ["Condition", condition],
        ["Referred by", `Dr. ${pick(somali.FAMILY_NAMES)}, ${pick(["Banadir Hospital", "De Martino Hospital", "Kalkaal Hospital", "Somali-Turkish Hospital", "Hargeisa Group Hospital", "Yardimeli Hospital"])}`],
      ],
      paragraphs: [
        `${patient.firstName} ${patient.lastName}, a ${Math.floor((now - patient.dateOfBirth) / (365 * 86_400_000))}-year-old ${gender.toLowerCase()} patient, is referred for specialist evaluation and management of the above condition, which cannot be treated adequately with locally available facilities.`,
        "Attached investigations: laboratory panel, imaging and specialist consultation notes. The family requests assistance with hospital selection, cost estimation and visa processing.",
      ],
    }),
    addDays(createdAt, rand() * 2),
  );
  if (chance(0.4)) {
    await addDoc(
      "CASE_DOCUMENT",
      await scanImage({
        title: "MEDICAL SUMMARY REPORT",
        caseNumber,
        fields: [["Patient", `${patient.firstName} ${patient.lastName}`], ["Prepared", createdAt.toLocaleDateString("en-GB")]],
        paragraphs: [
          "History, examination findings and the results of relevant investigations are summarised below for the receiving hospital's review.",
          condition + ". Management options discussed with the family; overseas referral agreed.",
        ],
      }),
      addDays(createdAt, 2 + rand() * 3),
    );
  }
  if (attendant) {
    await addDoc("ATTENDANT_PASSPORT", await passportImage(attendant), addDays(createdAt, rand() * 2));
  }

  if (stopAt === "NEW") {
    await flush();
    return { status: "NEW", kase, chosenInquiry: null, treatmentCost: null };
  }

  // ---- hospital matching ----
  await prisma.case.update({ where: { id: kase.id }, data: { status: "HOSPITAL_MATCHING" } });
  const matchStart = addDays(createdAt, 1 + rand() * 6);
  pushEvent("CASE_STATUS_CHANGED", "HOSPITAL_MATCHING", matchStart, { fromStatus: "NEW" });

  const specialtyHospitals = pickN(ctx.hospitals, int(2, 5));
  const inquiries = [];
  for (let i = 0; i < specialtyHospitals.length; i += 1) {
    const h = specialtyHospitals[i];
    const sentAt = addDays(matchStart, i * (0.5 + rand() * 2));
    const inq = await prisma.hospitalInquiry.create({
      data: {
        caseId: kase.id, hospitalId: h.id, status: "PENDING",
        notes: chance(0.4) ? "Sent case summary and imaging for cost estimate." : null,
        sentAt: notAfter(sentAt, NOW), createdAt: notAfter(sentAt, NOW),
      },
    });
    inquiries.push({ row: inq, hospital: h, sentAt });
  }
  if (chance(0.5)) {
    pushNote(pick(["Sent case to " + inquiries.length + " hospitals for estimates.", "Awaiting hospital responses.", "Family prefers a hospital with a shorter waiting list."]), addDays(matchStart, 1));
  }

  if (stopAt === "HOSPITAL_MATCHING") {
    // maybe decline one or two
    for (const inq of inquiries) {
      if (chance(0.25)) {
        const at = addDays(inq.sentAt, 2 + rand() * 6);
        await prisma.hospitalInquiry.update({
          where: { id: inq.row.id },
          data: { status: "DECLINED", respondedAt: notAfter(at, NOW), notes: "Hospital unable to take the case at this time." },
        });
        pushEvent("INQUIRY_STATUS_CHANGED", "DECLINED", at, { fromStatus: "PENDING", inquiryId: inq.row.id });
      }
    }
    if (cancelling) return cancelHere("HOSPITAL_MATCHING", addDays(matchStart, 3 + rand() * 20));
    await flush();
    return { status: "HOSPITAL_MATCHING", kase, chosenInquiry: null, treatmentCost: null };
  }

  if (targetStatus === "HOSPITAL_DECLINED") {
    let last = matchStart;
    for (const inq of inquiries) {
      const at = addDays(inq.sentAt, 3 + rand() * 8);
      last = at;
      await prisma.hospitalInquiry.update({
        where: { id: inq.row.id },
        data: { status: "DECLINED", respondedAt: notAfter(at, NOW), notes: "Declined — case complexity / capacity." },
      });
      pushEvent("INQUIRY_STATUS_CHANGED", "DECLINED", at, { fromStatus: "PENDING", inquiryId: inq.row.id });
    }
    await prisma.case.update({ where: { id: kase.id }, data: { status: "HOSPITAL_DECLINED" } });
    pushEvent("CASE_STATUS_CHANGED", "HOSPITAL_DECLINED", addDays(last, 0.5), { fromStatus: "HOSPITAL_MATCHING" });
    pushNote("All approached hospitals declined. Discussing alternatives with the family.", addDays(last, 1), manager);
    await flush();
    return { status: "HOSPITAL_DECLINED", kase, chosenInquiry: null, treatmentCost: null };
  }

  // ---- choose a hospital (HOSPITAL_ACCEPTED and beyond) ----
  const treatmentCost = estimateCost(condition);
  const respondAt = addDays(matchStart, 5 + rand() * 14);

  // optionally: chose one, then changed to another before any fee
  let chosenIdx = int(0, inquiries.length - 1);
  const willChange = inquiries.length > 1 && chance(0.12);
  let firstChosenIdx = null;
  if (willChange) {
    firstChosenIdx = chosenIdx;
    let other = int(0, inquiries.length - 1);
    if (other === chosenIdx) other = (other + 1) % inquiries.length;
    chosenIdx = other;
  }

  // non-chosen inquiries: NOT_SELECTED (a couple DECLINED)
  for (let i = 0; i < inquiries.length; i += 1) {
    if (i === chosenIdx) continue;
    const declined = chance(0.3);
    const at = addDays(respondAt, -1 + rand() * 2);
    await prisma.hospitalInquiry.update({
      where: { id: inquiries[i].row.id },
      data: {
        status: declined ? "DECLINED" : "NOT_SELECTED",
        respondedAt: notAfter(at, NOW),
        notes: declined ? "Hospital declined the case." : "Not selected — higher cost / longer wait.",
      },
    });
    if (declined) {
      pushEvent("INQUIRY_STATUS_CHANGED", "DECLINED", at, { fromStatus: "PENDING", inquiryId: inquiries[i].row.id });
    }
  }

  async function recordChosen(idx, at, isChange) {
    const inq = inquiries[idx];
    await prisma.hospitalInquiry.update({
      where: { id: inq.row.id },
      data: {
        status: "ACCEPTED", isChosen: true,
        treatmentCostEstimate: treatmentCost, currency: CURRENCY_USD,
        notes: `Accepted for treatment. Estimated package USD ${treatmentCost.toLocaleString()}.`,
        respondedAt: notAfter(at, NOW),
      },
    });
    await addDoc(
      "EVALUATION_DOC",
      await letterImage({
        hospitalName: inq.hospital.name, hospitalCity: inq.hospital.city,
        title: "MEDICAL EVALUATION REPORT",
        refNumber: `${inq.hospital.name.split(" ")[0].toUpperCase()}/EVAL/${caseNumber.slice(-4)}`,
        dateOn: at,
        bodyLines: [
          `Patient: ${patient.firstName} ${patient.lastName}    Passport: ${patient.passportNumber}`,
          `Condition: ${condition}`,
          "",
          "Our specialist team has reviewed the submitted records and imaging.",
          "The patient is a suitable candidate for treatment at this facility.",
          "",
          `Proposed plan: admission, work-up, definitive procedure and post-operative care.`,
          `Estimated package cost: USD ${treatmentCost.toLocaleString()} (excludes visa and travel).`,
          `Expected length of stay: ${int(5, 21)} days.`,
        ],
        signerName: `Dr. ${pick(["R. Menon", "S. Iyer", "A. Khan", "P. Sharma", "M. Yilmaz", "J. Otieno", "H. El-Sayed"])}`,
        signerRole: `Consultant, ${pick(SPECIALTIES)}`,
      }),
      at,
      inq.row.id,
    );
    await addDoc(
      "INVITATION_LETTER",
      await letterImage({
        hospitalName: inq.hospital.name, hospitalCity: inq.hospital.city,
        title: "LETTER OF INVITATION FOR MEDICAL TREATMENT",
        refNumber: `${inq.hospital.name.split(" ")[0].toUpperCase()}/INV/${caseNumber.slice(-4)}`,
        dateOn: addDays(at, 1),
        bodyLines: [
          "To the Honourable Embassy / Consulate,",
          "",
          `This letter confirms that ${patient.firstName} ${patient.lastName} (Passport ${patient.passportNumber})`,
          `has been accepted for medical treatment at ${inq.hospital.name}, ${inq.hospital.city}.`,
          attendant ? `One attendant, ${attendant.firstName} ${attendant.lastName} (${attendant.relationToPatient}), will accompany the patient.` : "The patient will travel alone.",
          "",
          "We request that a medical visa be granted for the purpose of this treatment.",
          `Estimated treatment cost: USD ${treatmentCost.toLocaleString()}.`,
        ],
        signerName: `Dr. ${pick(["R. Menon", "S. Iyer", "A. Khan", "P. Sharma", "M. Yilmaz", "J. Otieno", "H. El-Sayed"])}`,
        signerRole: "Head, International Patient Services",
      }),
      addDays(at, 1),
      inq.row.id,
    );
    pushEvent(isChange ? "HOSPITAL_CHANGED" : "HOSPITAL_CHOSEN", "ACCEPTED", at, { inquiryId: inq.row.id });
    return inq;
  }

  if (willChange) {
    // first choice, then flip
    const firstAt = addDays(respondAt, -6 - rand() * 4);
    await recordChosen(firstChosenIdx, firstAt, false);
    // demote first choice
    await prisma.hospitalInquiry.update({
      where: { id: inquiries[firstChosenIdx].row.id },
      data: { status: "NOT_SELECTED", isChosen: false, notes: "Superseded — a better estimate was received." },
    });
    pushNote("Chosen hospital changed after a lower cost estimate came in.", addDays(respondAt, -3), manager);
  }
  const chosen = await recordChosen(chosenIdx, respondAt, willChange);

  await prisma.case.update({ where: { id: kase.id }, data: { status: "HOSPITAL_ACCEPTED" } });
  pushEvent("CASE_STATUS_CHANGED", "HOSPITAL_ACCEPTED", addDays(respondAt, 0.2), { fromStatus: "HOSPITAL_MATCHING" });
  if (chance(0.5)) pushNote("Invitation letter received and forwarded to the family. Preparing visa paperwork.", addDays(respondAt, 1));

  // visa applications (both direct and agency have them by the time processing starts)
  const travelers = ["PATIENT", ...(attendant ? ["ATTENDANT"] : [])];
  const visaApps = {};
  if (stopAt === "HOSPITAL_ACCEPTED") {
    // direct cases auto-create visa apps on acceptance; agency cases don't yet
    if (reachOutType === "DIRECT") {
      for (const t of travelers) {
        visaApps[t] = await prisma.visaApplication.create({
          data: { caseId: kase.id, travelerType: t, status: "PENDING", createdAt: notAfter(addDays(respondAt, 0.3), NOW) },
        });
      }
    }
    if (cancelling) return cancelHere("HOSPITAL_ACCEPTED", notAfter(addDays(respondAt, 4 + rand() * 25), NOW));
    await flush();
    return { status: "HOSPITAL_ACCEPTED", kase, chosenInquiry: chosen, treatmentCost };
  }

  // VISA_PROCESSING and beyond -> all travelers have a visa app
  for (const t of travelers) {
    visaApps[t] = await prisma.visaApplication.create({
      data: { caseId: kase.id, travelerType: t, status: "PENDING", createdAt: notAfter(addDays(respondAt, 0.3), NOW) },
    });
  }
  await prisma.case.update({ where: { id: kase.id }, data: { status: "VISA_PROCESSING" } });
  const visaStart = addDays(respondAt, 3 + rand() * 10);
  pushEvent("CASE_STATUS_CHANGED", "VISA_PROCESSING", visaStart, { fromStatus: "HOSPITAL_ACCEPTED" });

  // fee payment on patient (and often attendant)
  const feeAccount = pick(ctx.inflowAccounts);
  const payTravelers = attendant && chance(0.75) ? travelers : ["PATIENT"];
  for (const t of payTravelers) {
    const va = visaApps[t];
    const feeAmount = reachOutType === "AGENCY" ? money(50, 150, 5) : money(120, 480, 10);
    const paidAt = notAfter(addDays(visaStart, rand() * 5), NOW);
    const payment = await prisma.payment.create({
      data: {
        visaApplicationId: va.id, amount: feeAmount, currency: CURRENCY_USD,
        feeType: reachOutType, receivedById: financeUser.id,
        paidAt, createdAt: paidAt,
      },
    });
    await prisma.accountTransaction.create({
      data: {
        accountId: feeAccount.id, type: "PAYMENT_RECEIVED", amount: feeAmount, currency: CURRENCY_USD,
        notes: `Visa fee — ${t.toLowerCase()} — ${caseNumber}`, createdById: financeUser.id,
        occurredAt: paidAt, createdAt: paidAt, paymentId: payment.id,
      },
    });
    await prisma.visaApplication.update({ where: { id: va.id }, data: { status: "FEE_PAID" } });
    pushEvent("VISA_STATUS_CHANGED", "FEE_PAID", addDays(paidAt, 0.1), { visaApplicationId: va.id });
  }
  if (chance(0.6)) pushNote("Visa fee paid via Hormuud EVC Plus. Receipt on file.", addDays(visaStart, 1));

  // case-linked expenses — from a bank/wallet, occasionally petty cash
  const expenseAccount = chance(0.2) ? ctx.cashAccount : pick(ctx.inflowAccounts);
  for (let i = 0; i < int(1, 3); i += 1) {
    const cat = pick(CASE_EXPENSE_CATEGORIES);
    const amt = money(15, 220, 5);
    const at = notAfter(addDays(visaStart, 1 + rand() * 12), NOW);
    const exp = await prisma.expense.create({
      data: {
        category: cat, amount: amt, currency: CURRENCY_USD, notes: `${cat} — ${caseNumber}`,
        caseId: kase.id, paidById: financeUser.id, incurredAt: at, createdAt: at,
      },
    });
    await prisma.accountTransaction.create({
      data: {
        accountId: expenseAccount.id, type: "EXPENSE_PAID", amount: amt, currency: CURRENCY_USD,
        notes: cat, createdById: financeUser.id, occurredAt: at, createdAt: at, expenseId: exp.id,
      },
    });
  }

  // embassy visit on patient (~65% of visa-processing+ cases)
  let embassyDone = false;
  if (chance(0.65)) {
    const va = visaApps.PATIENT;
    const visitAt = notAfter(addDays(visaStart, 6 + rand() * 14), NOW);
    await prisma.visaApplication.update({
      where: { id: va.id },
      data: { status: "EMBASSY_VISITED", embassyVisitDate: visitAt, notes: "Attended the embassy for biometrics and interview." },
    });
    pushEvent("VISA_STATUS_CHANGED", "EMBASSY_VISITED", addDays(visitAt, 0.1), { visaApplicationId: va.id });
    embassyDone = true;
    // embassy partnership commission (~40% of embassy visits)
    if (chance(0.4)) {
      const commAmt = money(20, 80, 5);
      const exp = await prisma.expense.create({
        data: {
          category: "Embassy partnership commission", amount: commAmt, currency: CURRENCY_USD,
          notes: "Embassy partnership commission", caseId: kase.id, visaApplicationId: va.id,
          paidById: financeUser.id, incurredAt: visitAt, createdAt: visitAt,
        },
      });
      await prisma.accountTransaction.create({
        data: {
          accountId: expenseAccount.id, type: "EXPENSE_PAID", amount: commAmt, currency: CURRENCY_USD,
          notes: "Embassy partnership commission", createdById: financeUser.id,
          occurredAt: visitAt, createdAt: visitAt, expenseId: exp.id,
        },
      });
    }
    if (chance(0.4)) pushNote("Embassy visit completed. Awaiting decision.", addDays(visitAt, 1));
  }

  if (stopAt === "VISA_PROCESSING") {
    if (cancelling) {
      const cancelAt = notAfter(addDays(visaStart, 8 + rand() * 30), NOW);
      // ~55% of the time the visa fee is refunded on cancellation
      if (chance(0.55)) {
        const firstPayment = await prisma.payment.findFirst({
          where: { visaApplication: { caseId: kase.id } },
          orderBy: { paidAt: "asc" },
        });
        if (firstPayment) {
          const refundAmt = chance(0.7) ? Number(firstPayment.amount) : money(20, Number(firstPayment.amount), 5);
          const refund = await prisma.refund.create({
            data: {
              paymentId: firstPayment.id, amount: refundAmt,
              reason: "Case cancelled before travel — visa fee refunded.",
              refundedById: financeUser.id, refundedAt: cancelAt, createdAt: cancelAt,
            },
          });
          await prisma.accountTransaction.create({
            data: {
              accountId: feeAccount.id, type: "REFUND_ISSUED", amount: refundAmt, currency: CURRENCY_USD,
              notes: `Refund — ${caseNumber}`, createdById: financeUser.id,
              occurredAt: cancelAt, createdAt: cancelAt, refundId: refund.id,
            },
          });
        }
      }
      return cancelHere("VISA_PROCESSING", cancelAt);
    }
    await flush();
    return { status: "VISA_PROCESSING", kase, chosenInquiry: chosen, treatmentCost, visaApps };
  }

  // ---- COMPLETED ----
  const decisionAt = notAfter(addDays(visaStart, embassyDone ? 14 + rand() * 20 : 20 + rand() * 25), NOW);
  for (const t of travelers) {
    const va = visaApps[t];
    const rejected = t === "PATIENT" ? chance(0.06) : chance(0.03);
    if (rejected) {
      await prisma.visaApplication.update({
        where: { id: va.id },
        data: { status: "REJECTED", notes: "Visa refused. Re-application under consideration." },
      });
      pushEvent("VISA_STATUS_CHANGED", "REJECTED", decisionAt, { visaApplicationId: va.id });
    } else {
      const visaNumber = `VM${int(1000000, 9999999)}`;
      await prisma.visaApplication.update({
        where: { id: va.id },
        data: { status: "APPROVED", visaNumber, notes: "Visa approved. Travel arranged." },
      });
      pushEvent("VISA_STATUS_CHANGED", "APPROVED", decisionAt, { visaApplicationId: va.id });
      const person = t === "PATIENT" ? patient : attendant;
      await addDoc(
        "VISA_COPY",
        await visaCopyImage({
          firstName: person.firstName, lastName: person.lastName, passportNumber: person.passportNumber,
          country: chosen.hospital.country, visaNumber,
          issueDate: decisionAt, expiryDate: addMonths(decisionAt, 6),
          purpose: t === "PATIENT" ? "MEDICAL (MED-X)" : "MEDICAL ATTENDANT (MED-A)",
        }),
        addDays(decisionAt, 0.5),
      );
    }
  }

  const completeAt = notAfter(addDays(decisionAt, 20 + rand() * 40), NOW);
  await prisma.case.update({ where: { id: kase.id }, data: { status: "COMPLETED" } });
  pushEvent("CASE_STATUS_CHANGED", "COMPLETED", completeAt, { fromStatus: "VISA_PROCESSING" });
  pushNote("Patient treated and discharged. Back home; follow-up scheduled in 3 months.", completeAt, manager);

  // hospital referral commission revenue (case-linked)
  const commissionPct = 0.06 + rand() * 0.09; // 6–15%
  const commission = Math.round(treatmentCost * commissionPct * 100) / 100;
  const revAccount = pick(ctx.inflowAccounts);
  const receivedOn = notAfter(addDays(completeAt, 5 + rand() * 30), NOW);
  const rev = await prisma.revenue.create({
    data: {
      category: "HOSPITAL_REFERRAL_COMMISSION", amount: commission, currency: CURRENCY_USD,
      description: `Referral commission — ${chosen.hospital.name} — ${caseNumber}`,
      receivedOn, caseId: kase.id, accountId: revAccount.id, recordedById: financeUser.id,
      createdAt: receivedOn,
    },
  });
  await prisma.accountTransaction.create({
    data: {
      accountId: revAccount.id, type: "REVENUE_RECEIVED", amount: commission, currency: CURRENCY_USD,
      notes: `Referral commission — ${caseNumber}`, createdById: financeUser.id,
      occurredAt: receivedOn, createdAt: receivedOn, revenueId: rev.id,
    },
  });

  await flush();
  return { status: "COMPLETED", kase, chosenInquiry: chosen, treatmentCost, commission };

  async function flush() {
    if (events.length) await prisma.caseEvent.createMany({ data: events });
    if (notes.length) await prisma.caseNote.createMany({ data: notes });
  }
}
