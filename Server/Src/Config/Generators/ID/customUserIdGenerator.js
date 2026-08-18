import Prisma from "../../Prisma/db.js";

/**
 * Generates a custom user ID with the format:
 * ASR-ROLECODE-YY-MM-####
 * Example: ASR-ADM-25-09-0001
 *
 * @param {string} role - The user's role
 * @returns {Promise<string>} The generated custom user ID
 */
export const generateCustomUserId = async (role) => {
  const prefix = "ASR";

  if (!role) {
    throw new Error("Role must be provided");
  }

  // Derive a 3-letter role code from the role name, e.g. "ADMIN" -> "ADM"
  const roleCode = role.slice(0, 3).toUpperCase();

  const date = new Date();
  const year = date.getFullYear().toString().slice(-2); // last two digits
  const month = (date.getMonth() + 1).toString().padStart(2, "0");

  const baseId = `${prefix}-${roleCode}-${year}-${month}`;

  // Find the most recent user for this role and time period
  const lastUser = await Prisma.user.findFirst({
    where: {
      id: {
        startsWith: baseId, // Match prefix + role + year + month
      },
    },
    orderBy: { id: "desc" },
  });

  let sequence = 1;
  if (lastUser) {
    const lastSeqStr = lastUser.id.split("-").pop(); // get #### part
    const lastSeq = parseInt(lastSeqStr, 10);

    // Validate the parsed sequence number
    if (isNaN(lastSeq) || lastSeq < 0) {
      console.warn(
        `Invalid sequence number found for user ${lastUser.id}, resetting to 1`,
      );
      sequence = 1;
    } else {
      sequence = lastSeq + 1;
    }
  }

  // Pad the sequence to 4 digits
  const customId = `${baseId}-${sequence.toString().padStart(4, "0")}`;

  return customId;
};
