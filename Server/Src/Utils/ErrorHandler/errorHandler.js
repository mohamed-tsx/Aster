// Custom error class for business logic errors
export class AppError extends Error {
  constructor(message, statusCode = 400, errorCode = "BUSINESS_LOGIC_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error wrapper
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFound = (req, res, next) => {
  const error = new AppError(
    `Not found - ${req.originalUrl}`,
    404,
    "NOT_FOUND",
  );
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errorCode = "INTERNAL_ERROR";

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error: " + err.message;
    errorCode = "VALIDATION_ERROR";
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
    errorCode = "INVALID_ID";
  } else if (err.code === 11000) {
    statusCode = 409;
    message = "Duplicate entry: " + Object.keys(err.keyValue).join(", ");
    errorCode = "DUPLICATE_ENTRY";
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
    errorCode = "INVALID_TOKEN";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
    errorCode = "TOKEN_EXPIRED";
  } else if (err.name === "PrismaClientKnownRequestError") {
    if (err.code === "P2002") {
      statusCode = 409;
      message = "Duplicate entry";
      errorCode = "DUPLICATE_ENTRY";
    } else if (err.code === "P2025") {
      statusCode = 404;
      message = "Record not found";
      errorCode = "RECORD_NOT_FOUND";
    } else if (err.code === "P2003") {
      statusCode = 400;
      message = "Foreign key constraint failed";
      errorCode = "FOREIGN_KEY_ERROR";
    } else if (err.code === "P2014") {
      statusCode = 400;
      message = "Invalid ID provided";
      errorCode = "INVALID_ID";
    } else {
      statusCode = 400;
      message = "Database error";
      errorCode = "DATABASE_ERROR";
    }
  } else if (err.name === "PrismaClientValidationError") {
    statusCode = 400;
    message = "Database validation error";
    errorCode = "DATABASE_VALIDATION_ERROR";
  } else if (err.name === "MulterError") {
    statusCode = 400;
    message = "File upload error: " + err.message;
    errorCode = "FILE_UPLOAD_ERROR";
  } else if (err.name === "AppError") {
    statusCode = err.statusCode || 400;
    message = err.message;
    errorCode = err.errorCode || "BUSINESS_LOGIC_ERROR";
  }

  // Log error for debugging with more context
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack,
    },
    request: {
      url: req.url,
      method: req.method,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      userId: req.user?.id || null,
    },
    response: {
      statusCode,
    },
  };

  // Log to console with different levels based on status code
  if (statusCode >= 500) {
    console.error("SERVER_ERROR:", errorLog);
  } else if (statusCode >= 400) {
    console.warn("CLIENT_ERROR:", errorLog);
  } else {
    console.info("ERROR:", errorLog);
  }

  // Set response status
  res.status(statusCode);

  // Prepare error response
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: message,
      timestamp: new Date().toISOString(),
      requestId: req.id || "unknown",
    },
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.error.stack = err.stack;
    errorResponse.error.details = errorLog;
  }

  // Send appropriate response based on content type
  const contentType = req.get("Content-Type");

  if (contentType === "application/json" || req.accepts("json")) {
    res.json(errorResponse);
  } else {
    res.send(`Error ${statusCode}: ${message}`);
  }
};
