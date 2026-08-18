import jwt from "jsonwebtoken";

/**
 * Generate JWT access token
 * @param {Object} user - User object with id, username, email
 * @param {string} role - Role code (optional, for embedding in token)
 * @returns {string} JWT token
 */
export const generateAccessToken = (user, role = "") => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );
};

/**
 * Generate JWT refresh token
 * @param {Object} user - User object with id
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
    },
  );
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Verify refresh token
 * @param {string} token - Refresh token to verify
 * @returns {Object} Decoded token payload
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  );
};
