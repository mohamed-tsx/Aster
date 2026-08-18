/**
 * @desc Standardize API responses
 */
export const sendResponse = (
  res,
  statusCode,
  success,
  message,
  data = null,
  extra = {},
) => {
  return res.status(statusCode).json({
    success,
    message,
    data,
    ...extra,
  });
};

export const sendSuccess = (res, message, data = null, extra = {}) => {
  return sendResponse(res, 200, true, message, data, extra);
};

export const sendCreated = (res, message, data = null, extra = {}) => {
  return sendResponse(res, 201, true, message, data, extra);
};

export const sendError = (res, statusCode, message, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};
