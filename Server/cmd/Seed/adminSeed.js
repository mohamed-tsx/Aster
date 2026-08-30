import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Prisma from "../../Src/Config/Prisma/db.js";
import { generateCustomUserId } from "../../Src/Config/Generators/ID/customUserIdGenerator.js";
import { SETTING_DEFAULTS } from "../../Src/Services/Settings/settingsService.js";

dotenv.config();

async function main() {
  console.log("🌱 Starting system seed...");

  /**
   * CREATE ADMIN USER
   */

  console.log("🔹 Creating admin user...");

  const adminEmail = process.env.ADMIN_EMAIL || "admin@asterreferral.com";
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  console.log("🔹 Seeding permissions...");

  const userManagementPermissions = [
    "VIEW_USERS",
    "CREATE_USERS",
    "UPDATE_USERS",
    "DELETE_USERS",
    "MANAGE_ROLES",
  ];

  const caseManagementPermissions = [
    "VIEW_CASES",
    "CREATE_CASES",
    "UPDATE_CASES",
    "DELETE_CASES",
    "MANAGE_HOSPITALS",
    "MANAGE_AGENCIES",
    "MANAGE_ACCOUNTS",
    "VIEW_FINANCE",
    "MANAGE_FINANCE",
    "ISSUE_REFUNDS",
    "MANAGE_SETTINGS",
    "RECORD_HOSPITAL_RESPONSE",
    "MANAGE_REVENUE",
    "MANAGE_LOANS",
    "MANAGE_PAYABLES",
  ];

  const allPermissionNames = [
    ...userManagementPermissions,
    ...caseManagementPermissions,
  ];

  const permissions = await Promise.all(
    allPermissionNames.map((name) =>
      Prisma.permission.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  const adminRole = await Prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {
      permissions: { connect: permissions.map((p) => ({ id: p.id })) },
    },
    create: {
      name: "ADMIN",
      permissions: { connect: permissions.map((p) => ({ id: p.id })) },
    },
  });

  await Promise.all(
    Object.entries(SETTING_DEFAULTS).map(([key, value]) =>
      Prisma.appSetting.upsert({ where: { key }, update: {}, create: { key, value } }),
    ),
  );
  console.log("🔹 Seeded app settings defaults");

  let admin = await Prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!admin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const userId = await generateCustomUserId(adminRole.name);

    admin = await Prisma.user.create({
      data: {
        id: userId,
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        firstName: "System",
        lastName: "Administrator",
        roleId: adminRole.id,
      },
    });

    console.log("✅ Admin user created:", admin.email);
    console.log("🔐 Default password:", adminPassword);
  } else {
    console.log("ℹ️ Admin user already exists:", admin.email);
  }

  console.log("✨ System seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await Prisma.$disconnect();
  });
