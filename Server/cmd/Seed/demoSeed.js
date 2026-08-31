/**
 * Demo / fixture seed — wipes the dev database and fills it with a large,
 * realistic, Somali-flavoured dataset: staff, hospitals, agencies, ~400 cases
 * across every lifecycle stage (with generated passport / letter / visa
 * document images), plus the full finance picture — payments, refunds,
 * revenue, loans + repayments, payables, expenses and the account ledger.
 *
 *   npm run seed:demo         (from Server/)
 *
 * Refuses to run against a database whose URL looks like a test database.
 */

import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import Prisma from "../../Src/Config/Prisma/db.js";
import { generateCustomUserId } from "../../Src/Config/Generators/ID/customUserIdGenerator.js";
import { SETTING_DEFAULTS } from "../../Src/Services/Settings/settingsService.js";
import { saveAvatarLocal } from "../../Src/Utils/Avatar/saveAvatarLocal.js";
import { buildCase } from "./demo/buildCase.js";
import { avatarImage } from "./demo/docImages.js";
import {
  reseed, int, pick, pickN, weighted, money, chance, rand, addMonths, daysAgo, addDays, notAfter,
} from "./demo/rng.js";
import * as somali from "./demo/somali.js";
import {
  HOSPITALS, HOSPITAL_CONTACTS, SPECIALTIES, ACCOUNTS, LENDERS,
  GENERAL_EXPENSE_CATEGORIES, REVENUE_OTHER_DESCRIPTIONS, PAYABLE_REASONS,
} from "./demo/catalog.js";

const NOW = new Date();
const DEMO_PASSWORD = "password123";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@asterreferral.com";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const USER_PERMISSIONS = ["VIEW_USERS", "CREATE_USERS", "UPDATE_USERS", "DELETE_USERS", "MANAGE_ROLES"];
const CASE_PERMISSIONS = [
  "VIEW_CASES", "CREATE_CASES", "UPDATE_CASES", "DELETE_CASES", "MANAGE_HOSPITALS", "MANAGE_AGENCIES",
  "MANAGE_ACCOUNTS", "VIEW_FINANCE", "MANAGE_FINANCE", "ISSUE_REFUNDS", "MANAGE_SETTINGS",
  "RECORD_HOSPITAL_RESPONSE", "MANAGE_REVENUE", "MANAGE_LOANS", "MANAGE_PAYABLES",
];
const ALL_PERMISSIONS = [...USER_PERMISSIONS, ...CASE_PERMISSIONS];

const ROLE_DEFS = {
  ADMIN: ALL_PERMISSIONS,
  CASE_MANAGER: [
    "VIEW_USERS", "VIEW_CASES", "CREATE_CASES", "UPDATE_CASES", "DELETE_CASES",
    "MANAGE_HOSPITALS", "MANAGE_AGENCIES", "RECORD_HOSPITAL_RESPONSE", "VIEW_FINANCE",
  ],
  CASE_OFFICER: ["VIEW_CASES", "CREATE_CASES", "UPDATE_CASES", "RECORD_HOSPITAL_RESPONSE"],
  FINANCE_OFFICER: [
    "VIEW_CASES", "VIEW_FINANCE", "MANAGE_FINANCE", "MANAGE_ACCOUNTS", "ISSUE_REFUNDS",
    "MANAGE_REVENUE", "MANAGE_LOANS", "MANAGE_PAYABLES", "MANAGE_SETTINGS",
  ],
};

const STAFF_COUNTS = { ADMIN: 1, CASE_MANAGER: 4, CASE_OFFICER: 9, FINANCE_OFFICER: 5 };

const CASE_TARGET = Number(process.env.DEMO_CASES) || 400;
const CASE_CONCURRENCY = Number(process.env.DEMO_CONCURRENCY) || 6;
const STATUS_MIX = [
  ["NEW", 8], ["HOSPITAL_MATCHING", 15], ["HOSPITAL_DECLINED", 5], ["HOSPITAL_ACCEPTED", 17],
  ["VISA_PROCESSING", 24], ["COMPLETED", 23], ["CANCELLED", 8],
];

/** run `tasks` with a bounded concurrency */
async function pool(items, concurrency, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function rmUploads() {
  const dir = path.join(process.cwd(), "uploads");
  await fs.rm(dir, { recursive: true, force: true });
}

async function wipe(adminId) {
  const order = [
    "accountTransaction", "refund", "payment", "loanRepayment", "loan", "revenue", "payable",
    "expense", "document", "caseEvent", "caseNote", "hospitalInquiry", "visaApplication",
    "attendant", "case", "patient", "agency", "hospital", "account",
  ];
  for (const model of order) {
    const { count } = await Prisma[model].deleteMany({});
    if (count) process.stdout.write(`  cleared ${model} (${count})\n`);
  }
  await Prisma.appSetting.updateMany({
    where: adminId ? { updatedById: { not: adminId } } : {},
    data: { updatedById: null },
  });
  const { count: users } = await Prisma.user.deleteMany(
    adminId ? { where: { id: { not: adminId } } } : {},
  );
  if (users) process.stdout.write(`  cleared user (${users})\n`);
  await rmUploads();
}

async function ensureRolesAndPermissions() {
  const permissions = await Promise.all(
    ALL_PERMISSIONS.map((name) =>
      Prisma.permission.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );
  const byName = Object.fromEntries(permissions.map((p) => [p.name, p]));
  const roles = {};
  for (const [roleName, permNames] of Object.entries(ROLE_DEFS)) {
    const connect = permNames.map((n) => ({ id: byName[n].id }));
    roles[roleName] = await Prisma.role.upsert({
      where: { name: roleName },
      update: { permissions: { set: connect } },
      create: { name: roleName, permissions: { connect } },
    });
  }
  return roles;
}

async function ensureAdmin(adminRole) {
  let admin = await Prisma.user.findFirst({
    where: { OR: [{ email: ADMIN_EMAIL }, { username: ADMIN_USERNAME }] },
  });
  if (!admin) {
    admin = await Prisma.user.create({
      data: {
        id: await generateCustomUserId("ADMIN"),
        username: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        password: await bcrypt.hash(ADMIN_PASSWORD, 10),
        firstName: "System",
        lastName: "Administrator",
        roleId: adminRole.id,
      },
    });
  } else {
    admin = await Prisma.user.update({ where: { id: admin.id }, data: { roleId: adminRole.id } });
  }
  return admin;
}

async function seedStaff(roles) {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const staff = { ADMIN: [], CASE_MANAGER: [], CASE_OFFICER: [], FINANCE_OFFICER: [] };
  const usedUsernames = new Set();

  for (const [roleName, n] of Object.entries(STAFF_COUNTS)) {
    for (let k = 0; k < n; k += 1) {
      const gender = weighted([["MALE", 55], ["FEMALE", 45]]);
      const nm = somali.fullName(gender);
      let username = `${nm.first}.${nm.last}`.toLowerCase().normalize("NFD").replace(/[^a-z.]/g, "");
      while (usedUsernames.has(username)) username += String(int(1, 99));
      usedUsernames.add(username);

      const id = await generateCustomUserId(roleName);
      const user = await Prisma.user.create({
        data: {
          id,
          username,
          email: somali.emailFor(nm.first, nm.last),
          password: hash,
          firstName: nm.firstName,
          lastName: nm.lastName,
          roleId: roles[roleName].id,
          createdAt: daysAgo(700, 120, NOW.getTime()),
        },
      });
      try {
        const av = await avatarImage(nm.firstName, nm.lastName);
        const url = await saveAvatarLocal(av.buffer, "avatars", user.id, {
          preserveOriginal: true, mimeType: "image/png",
        });
        await Prisma.user.update({ where: { id: user.id }, data: { avatar: url } });
      } catch (e) {
        process.stdout.write(`  (avatar skipped for ${username}: ${e.message})\n`);
      }
      staff[roleName].push(user);
    }
  }
  return staff;
}

async function seedHospitals() {
  const rows = [];
  for (const [name, city, country] of HOSPITALS) {
    rows.push(
      await Prisma.hospital.create({
        data: {
          name, city, country,
          specialties: pickN(SPECIALTIES, int(3, 7)).join(", "),
          contactPerson: pick(HOSPITAL_CONTACTS),
          phone: `+${pick(["91", "971", "90", "254", "20", "66", "962", "966"])} ${int(100000000, 999999999)}`,
          email: `ipd@${name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 14)}.org`,
          createdAt: daysAgo(900, 200, NOW.getTime()),
        },
      }),
    );
  }
  return rows;
}

async function seedAgencies(count) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const contactGender = weighted([["MALE", 60], ["FEMALE", 40]]);
    const cn = somali.fullName(contactGender);
    rows.push(
      await Prisma.agency.create({
        data: {
          name: somali.agencyName(i),
          contactPerson: cn.firstName + " " + cn.lastName,
          phone: somali.somaliPhone(),
          email: somali.emailFor(cn.first, cn.last, `${somali.agencyName(i).toLowerCase().split(" ")[0].replace(/[^a-z]/g, "")}.so`),
          address: somali.streetAddress(),
          createdAt: daysAgo(800, 150, NOW.getTime()),
        },
      }),
    );
  }
  return rows;
}

async function seedAccounts(financeUser) {
  const rows = [];
  for (const a of ACCOUNTS) {
    const acc = await Prisma.account.create({
      data: {
        name: a.name, type: a.type, notes: null,
        createdAt: daysAgo(760, 400, NOW.getTime()),
      },
    });
    const at = daysAgo(755, 400, NOW.getTime());
    await Prisma.accountTransaction.create({
      data: {
        accountId: acc.id, type: "OPENING_BALANCE", amount: a.opening, currency: a.currency,
        notes: "Opening balance", createdById: financeUser.id, occurredAt: at, createdAt: at,
      },
    });
    rows.push({ ...acc, currency: a.currency });
  }
  return rows;
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const monthsBetween = (a, b) =>
  (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0);

async function seedLoans(ctx) {
  const LOAN_COUNT = 12;
  for (let i = 0; i < LOAN_COUNT; i += 1) {
    const lenderName = LENDERS[i % LENDERS.length] + (i >= LENDERS.length ? " (Facility II)" : "");
    const inr = i === LOAN_COUNT - 1;
    const currency = inr ? "INR" : "USD";
    const account = inr ? pick(ctx.accounts.filter((a) => a.currency === "INR")) : pick(ctx.inflowAccounts);
    const principal = inr ? money(1500000, 6000000, 50000) : money(12000, 120000, 1000);
    const termMonths = pick([6, 12, 12, 18, 24, 36]);
    const recordedById = pick(ctx.financeStaff).id;

    let mode = weighted([["settled", 33], ["partial", 55], ["fresh", 12]]);
    // settled loans must be fully in the past; fresh are brand new; partial are mid-term.
    const termDays = Math.round(termMonths * 30.44);
    let disbursedOn;
    if (mode === "fresh") {
      disbursedOn = daysAgo(75, 5, NOW.getTime());
    } else if (mode === "settled") {
      disbursedOn = daysAgo(termDays + int(120, 320), termDays + int(15, 90), NOW.getTime());
    } else {
      const minAge = Math.round(termDays * 0.2);
      const maxAge = Math.min(termDays - 25, termDays * 0.9);
      disbursedOn = daysAgo(Math.max(maxAge, minAge + 20), minAge, NOW.getTime());
    }
    const dueOn = addMonths(disbursedOn, termMonths);
    const elapsedMonths = Math.max(0, monthsBetween(disbursedOn, NOW));
    if (elapsedMonths < 1) mode = "fresh";

    // Interest-free loans: repay exactly the principal, in equal monthly instalments.
    const installment = round2(principal / termMonths);

    const loan = await Prisma.loan.create({
      data: {
        lenderName, principal, currency, interestRatePct: 0,
        interestMethod: "SIMPLE", disbursedOn, termMonths, dueOn,
        notes: pick([
          `Interest-free (qard hasan) · repay over ${termMonths} months.`,
          "Working-capital facility for hospital deposits.",
          "Bridge financing against expected referral commissions.",
          null,
        ]),
        accountId: account.id, recordedById, createdAt: disbursedOn,
      },
    });
    await Prisma.accountTransaction.create({
      data: {
        accountId: account.id, type: "LOAN_RECEIVED", amount: principal, currency,
        notes: `Loan from ${lenderName}`, createdById: recordedById,
        occurredAt: disbursedOn, createdAt: disbursedOn, loanId: loan.id,
      },
    });
    if (mode === "fresh") continue;

    // one repayment per elapsed month; a jittered installment, last one squares the books.
    const paidCount = mode === "settled"
      ? termMonths
      : Math.max(1, Math.min(elapsedMonths, termMonths - 1, int(1, termMonths - 1)));

    let paid = 0;
    for (let m = 1; m <= paidCount; m += 1) {
      const isLast = mode === "settled" && m === paidCount;
      let amount = isLast
        ? round2(principal - paid)
        : round2(installment * (0.94 + rand() * 0.12));
      if (amount <= 0) amount = round2(installment);
      paid = round2(paid + amount);
      const paidOn = notAfter(addMonths(disbursedOn, m), NOW);
      const rep = await Prisma.loanRepayment.create({
        data: { loanId: loan.id, amount, paidOn, accountId: account.id, recordedById, createdAt: paidOn },
      });
      await Prisma.accountTransaction.create({
        data: {
          accountId: account.id, type: "LOAN_REPAYMENT", amount, currency,
          notes: `Repayment to ${lenderName}`, createdById: recordedById,
          occurredAt: paidOn, createdAt: paidOn, loanRepaymentId: rep.id,
        },
      });
    }
    if (mode === "settled") {
      await Prisma.loan.update({ where: { id: loan.id }, data: { status: "SETTLED" } });
    }
  }
}

async function seedGeneralRevenue(ctx) {
  for (let i = 0; i < 22; i += 1) {
    const inr = chance(0.15);
    const currency = inr ? "INR" : "USD";
    const account = inr
      ? pick(ctx.accounts.filter((a) => a.currency === "INR"))
      : pick(ctx.inflowAccounts);
    const amount = inr ? money(8000, 120000, 1000) : money(120, 3800, 20);
    const receivedOn = daysAgo(360, 2, NOW.getTime());
    const rev = await Prisma.revenue.create({
      data: {
        category: "OTHER_INCOME", amount, currency,
        description: pick(REVENUE_OTHER_DESCRIPTIONS),
        receivedOn, accountId: account.id, recordedById: pick(ctx.financeStaff).id,
        createdAt: receivedOn,
      },
    });
    await Prisma.accountTransaction.create({
      data: {
        accountId: account.id, type: "REVENUE_RECEIVED", amount, currency,
        notes: rev.description, createdById: rev.recordedById,
        occurredAt: receivedOn, createdAt: receivedOn, revenueId: rev.id,
      },
    });
  }
}

async function seedGeneralExpenses(ctx) {
  // recurring monthly rent + salaries for the last ~12 months, plus ad-hoc
  for (let m = 12; m >= 1; m -= 1) {
    const monthDate = addMonths(NOW, -m);
    for (const cat of ["Office rent — Muqdisho", "Staff salaries"]) {
      const amount = cat.includes("rent") ? 1800 : money(6500, 9200, 100);
      const at = new Date(monthDate.getFullYear(), monthDate.getMonth(), int(1, 5));
      const acc = pick(ctx.inflowAccounts);
      const exp = await Prisma.expense.create({
        data: { category: cat, amount, currency: "USD", notes: null, paidById: pick(ctx.financeStaff).id, incurredAt: at, createdAt: at },
      });
      await Prisma.accountTransaction.create({
        data: {
          accountId: acc.id, type: "EXPENSE_PAID", amount, currency: "USD", notes: cat,
          createdById: exp.paidById, occurredAt: at, createdAt: at, expenseId: exp.id,
        },
      });
    }
  }
  for (let i = 0; i < 18; i += 1) {
    const cat = pick(GENERAL_EXPENSE_CATEGORIES);
    const amount = money(25, 900, 5);
    const at = daysAgo(350, 1, NOW.getTime());
    const acc = (amount < 120 && chance(0.5) ? ctx.cashAccount : pick(ctx.inflowAccounts));
    const exp = await Prisma.expense.create({
      data: { category: cat, amount, currency: "USD", notes: null, paidById: pick(ctx.financeStaff).id, incurredAt: at, createdAt: at },
    });
    await Prisma.accountTransaction.create({
      data: {
        accountId: acc.id, type: "EXPENSE_PAID", amount, currency: "USD", notes: cat,
        createdById: exp.paidById, occurredAt: at, createdAt: at, expenseId: exp.id,
      },
    });
  }
}

async function seedPayables(ctx, linkableCaseIds) {
  for (let i = 0; i < 26; i += 1) {
    const g = weighted([["MALE", 50], ["FEMALE", 45], ["OTHER", 5]]);
    const nm = somali.fullName(g === "OTHER" ? "MALE" : g);
    const payeeName = chance(0.5)
      ? `${nm.firstName} ${nm.lastName}`
      : pick(["Nabad Translations", "Geeska Couriers", "STAR FM Advertising", "Toosle Logistics", "Cabdiqani & Partners Advocates", "Muqdisho Handling Services"]);
    const amount = money(40, 4200, 25);
    const raisedOn = daysAgo(300, 3, NOW.getTime());
    const caseId = chance(0.4) && linkableCaseIds.length ? pick(linkableCaseIds) : null;
    const settled = chance(0.6);
    const payable = await Prisma.payable.create({
      data: {
        payeeName, amount, currency: "USD", reason: pick(PAYABLE_REASONS),
        raisedOn, caseId, status: settled ? "SETTLED" : "OUTSTANDING",
        settledOn: null, recordedById: pick(ctx.financeStaff).id, createdAt: raisedOn,
      },
    });
    if (settled) {
      const acc = pick(ctx.inflowAccounts);
      const settledOn = notAfter(addDays(raisedOn, int(3, 40)), NOW);
      await Prisma.payable.update({ where: { id: payable.id }, data: { settledOn } });
      await Prisma.accountTransaction.create({
        data: {
          accountId: acc.id, type: "PAYABLE_SETTLED", amount, currency: "USD",
          notes: `Settled payable to ${payeeName}`, createdById: payable.recordedById,
          occurredAt: settledOn, createdAt: settledOn, payableId: payable.id,
        },
      });
    }
  }
}

async function ensureSettings(adminId) {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await Prisma.appSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  await Prisma.appSetting.upsert({
    where: { key: "EMBASSY_COMMISSION_DEFAULT" },
    update: { value: "25", updatedById: adminId },
    create: { key: "EMBASSY_COMMISSION_DEFAULT", value: "25", updatedById: adminId },
  });
}

async function summary() {
  const models = [
    "user", "role", "hospital", "agency", "patient", "attendant", "case", "hospitalInquiry",
    "visaApplication", "document", "caseEvent", "caseNote", "payment", "refund", "expense",
    "revenue", "loan", "loanRepayment", "payable", "account", "accountTransaction",
  ];
  const counts = {};
  for (const m of models) counts[m] = await Prisma[m].count();
  const cases = await Prisma.case.groupBy({ by: ["status"], _count: { _all: true } });
  return { counts, cases };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || "";
  if (/_test(\b|["'?&]|$)/.test(dbUrl) || dbUrl.includes("_test")) {
    console.error("✋ Refusing to run: DATABASE_URL looks like a TEST database.\n   " + dbUrl);
    process.exit(1);
  }

  console.log("🌱 Demo seed starting.");
  console.log("   Target DB:", dbUrl.replace(/:\/\/[^@]+@/, "://***@"));
  console.log("   This WIPES all case / finance / hospital / agency / patient data and non-admin users.\n");

  reseed();

  const roles = await ensureRolesAndPermissions();
  const admin = await ensureAdmin(roles.ADMIN);

  console.log("🧹 Wiping existing data…");
  await wipe(admin.id);

  console.log("👥 Seeding staff…");
  const staff = await seedStaff(roles);
  const allStaff = Object.values(staff).flat();
  const caseStaff = [...staff.CASE_MANAGER, ...staff.CASE_OFFICER];
  const managers = [...staff.CASE_MANAGER, admin];
  const financeStaff = [...staff.FINANCE_OFFICER, admin];

  console.log("🏥 Seeding hospitals…");
  const hospitals = await seedHospitals();
  console.log("🤝 Seeding agencies…");
  const agencies = await seedAgencies(30);
  console.log("💳 Seeding accounts…");
  const accounts = await seedAccounts(financeStaff[0]);
  const usdAccounts = accounts.filter((a) => a.currency === "USD");
  // Money coming IN (fees, revenue, loans) lands in a bank/wallet — never petty cash.
  const inflowAccounts = usdAccounts.filter((a) => a.type !== "CASH");
  const cashAccount = usdAccounts.find((a) => a.type === "CASH") ?? usdAccounts[0];

  const ctx = {
    prisma: Prisma, hospitals, agencies, accounts, usdAccounts, inflowAccounts, cashAccount,
    caseStaff, managers, financeStaff,
  };

  // ---- build case number list bucketed by (backdated) month ----
  console.log(`📁 Building ${CASE_TARGET} cases…`);
  const AGE_BY_STAGE = {
    NEW: [70, 2], HOSPITAL_MATCHING: [110, 4], HOSPITAL_DECLINED: [150, 15],
    HOSPITAL_ACCEPTED: [190, 12], VISA_PROCESSING: [260, 25], COMPLETED: [340, 55],
    CANCELLED: [300, 20],
  };
  const specs = [];
  const monthCounters = {};
  for (let i = 0; i < CASE_TARGET; i += 1) {
    const targetStatus = weighted(STATUS_MIX);
    const [maxAge, minAge] = AGE_BY_STAGE[targetStatus];
    const createdAt = daysAgo(maxAge, minAge, NOW.getTime());
    const yy = String(createdAt.getFullYear()).slice(-2);
    const mm = String(createdAt.getMonth() + 1).padStart(2, "0");
    const key = `${yy}-${mm}`;
    monthCounters[key] = (monthCounters[key] || 0) + 1;
    const caseNumber = `ASR-CASE-${key}-${String(monthCounters[key]).padStart(4, "0")}`;
    specs.push({ targetStatus, caseNumber, createdAt });
  }

  let done = 0;
  const built = await pool(specs, CASE_CONCURRENCY, async (spec) => {
    const res = await buildCase(ctx, spec.targetStatus, spec.caseNumber, spec.createdAt);
    done += 1;
    if (done % 50 === 0) process.stdout.write(`  …${done}/${CASE_TARGET}\n`);
    return res;
  });

  const linkableCaseIds = built
    .filter((b) => ["COMPLETED", "CANCELLED", "VISA_PROCESSING"].includes(b.status))
    .map((b) => b.kase.id);

  console.log("🏦 Seeding loans & repayments…");
  await seedLoans(ctx);
  console.log("📈 Seeding other revenue…");
  await seedGeneralRevenue(ctx);
  console.log("🧾 Seeding operating expenses…");
  await seedGeneralExpenses(ctx);
  console.log("📌 Seeding payables…");
  await seedPayables(ctx, linkableCaseIds);
  console.log("⚙️  Ensuring settings…");
  await ensureSettings(admin.id);

  const { counts, cases } = await summary();
  console.log("\n✅ Demo seed complete.\n");
  console.log("   Row counts:");
  for (const [m, c] of Object.entries(counts)) console.log(`     ${m.padEnd(20)} ${c}`);
  console.log("\n   Cases by status:");
  for (const row of cases) console.log(`     ${row.status.padEnd(20)} ${row._count._all}`);
  console.log(`\n   Admin login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  console.log(`   Staff logins: <username> / ${DEMO_PASSWORD}   (e.g. ${allStaff[0]?.username})`);
  console.log("   Uploaded files: Server/uploads/  (documents + avatars)\n");
}

main()
  .catch((e) => {
    console.error("❌ Demo seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await Prisma.$disconnect();
  });
