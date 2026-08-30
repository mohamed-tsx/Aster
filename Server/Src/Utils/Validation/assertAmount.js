import { AppError } from "../ErrorHandler/errorHandler.js";

/**
 * `Number("abc")` is `NaN` and `NaN <= 0` is `false`, so a bare `Number(x) <= 0`
 * guard lets a non-numeric string straight through to Prisma, where it fails as
 * an opaque 500 instead of a 400. Every amount guard goes through here.
 *
 * @param {unknown} value
 * @returns {boolean} true when value is present and parses to a finite number > 0
 */
export const isPositiveAmount = (value) =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) > 0;

/**
 * Rejects undefined/null/""/non-numeric/<= 0.
 * @param {unknown} value
 * @param {string} message the full error message (call sites have their own wording)
 */
export const assertPositiveAmount = (value, message = "amount must be a positive number") => {
  if (!isPositiveAmount(value)) {
    throw new AppError(message, 400, "VALIDATION_ERROR");
  }
};

/**
 * Same as {@link assertPositiveAmount} but zero is valid (rates, commissions).
 * @param {unknown} value
 * @param {string} message
 */
export const assertNonNegativeAmount = (
  value,
  message = "amount must be zero or a positive number",
) => {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0
  ) {
    throw new AppError(message, 400, "VALIDATION_ERROR");
  }
};
