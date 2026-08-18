/** Must stay aligned with Server userValidation.js */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

export function validateUsernameFormat(username: string): {
  valid: boolean;
  message?: string;
} {
  const value = username.trim();
  if (!value) {
    return { valid: false, message: "Username is required" };
  }
  if (value.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      message: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    };
  }
  if (!USERNAME_PATTERN.test(value)) {
    return {
      valid: false,
      message: "Username must be 3–32 characters (letters, numbers, . _ -)",
    };
  }
  return { valid: true };
}
