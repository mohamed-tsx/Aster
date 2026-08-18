import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import Prisma from "../../Config/Prisma/db.js";

/**
 * JWT Authentication Middleware
 * Verifies JWT token from cookies or Authorization header
 * Attaches user with role to request object
 */
const Verify = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in cookies first
  if (req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization?.startsWith("Bearer")) {
    // Fallback to Authorization header for mobile apps
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    res.status(401);
    throw new Error("Authorization failed: No token provided");
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await Prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        createdAt: true,
        role: {
          include: { permissions: true },
        },
      },
    });

    if (!user) {
      res.status(401);
      throw new Error("Authentication failed: User not found");
    }

    // Attach user with role to request
    req.user = user;

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      res.status(401);
      throw new Error("Authorization failed: Invalid token");
    } else if (error.name === "TokenExpiredError") {
      res.status(401);
      throw new Error("Authorization failed: Token expired");
    } else {
      res.status(401);
      throw new Error("Authorization failed: " + error.message);
    }
  }
});

export default Verify;
