import Prisma from "../../Prisma/db.js";

/**
 * Generates a human-readable case number with the format:
 * ASR-CASE-YY-MM-####
 * Example: ASR-CASE-26-08-0001
 *
 * @returns {Promise<string>} The generated case number
 */
export const generateCaseNumber = async () => {
  const prefix = "ASR-CASE";

  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");

  const baseId = `${prefix}-${year}-${month}`;

  const lastCase = await Prisma.case.findFirst({
    where: {
      caseNumber: {
        startsWith: baseId,
      },
    },
    orderBy: { caseNumber: "desc" },
  });

  let sequence = 1;
  if (lastCase) {
    const lastSeqStr = lastCase.caseNumber.split("-").pop();
    const lastSeq = parseInt(lastSeqStr, 10);

    if (isNaN(lastSeq) || lastSeq < 0) {
      console.warn(
        `Invalid sequence number found for case ${lastCase.caseNumber}, resetting to 1`,
      );
      sequence = 1;
    } else {
      sequence = lastSeq + 1;
    }
  }

  return `${baseId}-${sequence.toString().padStart(4, "0")}`;
};
