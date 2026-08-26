import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const NOTE_INCLUDE = {
  author: { select: { id: true, firstName: true, lastName: true } },
};

/**
 * @param {string} caseId
 */
export const listCaseNotes = (caseId) =>
  Prisma.caseNote.findMany({
    where: { caseId },
    include: NOTE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

/**
 * @param {string} caseId
 * @param {{ body: string }} data
 * @param {string} userId
 */
export const createCaseNote = async (caseId, data, userId) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }

  const body = data.body?.trim();
  if (!body) {
    throw new AppError("body is required", 400, "VALIDATION_ERROR");
  }

  return Prisma.caseNote.create({
    data: { caseId, body, authorId: userId },
    include: NOTE_INCLUDE,
  });
};
