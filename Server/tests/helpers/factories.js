import Prisma from "../../Src/Config/Prisma/db.js";

const unique = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const createRole = async (permissionNames = []) => {
  const permissions = await Promise.all(
    permissionNames.map((name) =>
      Prisma.permission.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );
  return Prisma.role.create({
    data: {
      name: `ROLE_${unique()}`,
      permissions: { connect: permissions.map((p) => ({ id: p.id })) },
    },
  });
};

export const createUser = async ({ permissionNames = [], ...overrides } = {}) => {
  const role = await createRole(permissionNames);
  return Prisma.user.create({
    data: {
      username: `user_${unique()}`,
      password: "hashed",
      firstName: "Test",
      lastName: "User",
      roleId: role.id,
      ...overrides,
    },
  });
};

export const createAccount = async (overrides = {}) =>
  Prisma.account.create({
    data: { name: `Account ${unique()}`, type: "BANK", ...overrides },
  });

export const createPatient = async (overrides = {}) =>
  Prisma.patient.create({
    data: {
      firstName: "John",
      lastName: "Doe",
      gender: "MALE",
      dateOfBirth: new Date("1990-01-01"),
      nationality: "Testland",
      passportNumber: `P${unique()}`,
      passportExpiry: new Date("2030-01-01"),
      phone: "1234567890",
      ...overrides,
    },
  });

export const createCase = async ({ patientId, ...overrides } = {}) => {
  const id = patientId || (await createPatient()).id;
  return Prisma.case.create({
    data: {
      caseNumber: `C${unique()}`,
      reachOutType: "DIRECT",
      patientId: id,
      ...overrides,
    },
  });
};

export const createHospital = async (overrides = {}) =>
  Prisma.hospital.create({
    data: { name: `Hospital ${unique()}`, city: "Testville", country: "Testland", ...overrides },
  });

export const createLoan = async ({ accountId, recordedById, ...overrides } = {}) =>
  Prisma.loan.create({
    data: {
      lenderName: `Lender ${unique()}`,
      principal: 1000,
      currency: "USD",
      interestRatePct: 12,
      interestMethod: "SIMPLE",
      disbursedOn: new Date("2026-01-01"),
      termMonths: 12,
      dueOn: new Date("2027-01-01"),
      accountId,
      recordedById,
      ...overrides,
    },
  });

export const createRevenue = async ({ accountId, recordedById, ...overrides } = {}) =>
  Prisma.revenue.create({
    data: {
      category: "OTHER_INCOME",
      amount: 500,
      currency: "USD",
      receivedOn: new Date("2026-02-01"),
      accountId,
      recordedById,
      ...overrides,
    },
  });

export const createPayable = async ({ recordedById, ...overrides } = {}) =>
  Prisma.payable.create({
    data: {
      payeeName: `Payee ${unique()}`,
      amount: 300,
      currency: "USD",
      reason: "Test payable",
      raisedOn: new Date("2026-02-01"),
      recordedById,
      ...overrides,
    },
  });

export const createVisaApplication = async ({ caseId, ...overrides } = {}) =>
  Prisma.visaApplication.create({
    data: {
      caseId,
      travelerType: "PATIENT",
      ...overrides,
    },
  });

export const createPayment = async ({
  visaApplicationId,
  receivedById,
  accountId,
  amount = 100,
  currency = "USD",
}) =>
  Prisma.payment.create({
    data: {
      visaApplicationId,
      amount,
      currency,
      feeType: "DIRECT",
      receivedById,
      accountTransaction: {
        create: {
          accountId,
          type: "PAYMENT_RECEIVED",
          amount,
          currency,
          createdById: receivedById,
        },
      },
    },
  });

export const fakeUpload = (originalname = "file.pdf", mimetype = "application/pdf") => ({
  buffer: Buffer.from("test-file-content"),
  mimetype,
  originalname,
});

// The shape Multer's .fields() puts on req.files for a case-intake request.
export const caseIntakeFiles = () => ({
  patientPassport: [fakeUpload("passport.jpg", "image/jpeg")],
  caseDocument: [fakeUpload("case.pdf", "application/pdf")],
});

export const attachDocument = async ({
  caseId,
  type,
  uploadedById,
  fileName = "doc.pdf",
  fileUrl = "/uploads/documents/test/x.pdf",
}) =>
  Prisma.document.create({
    data: { caseId, type, fileName, fileUrl, uploadedById },
  });
