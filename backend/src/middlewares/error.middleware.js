const logger = require("../utils/logger");
const { serverError, fail } = require("../utils/response");

function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });

  if (err.code === "P2025") return fail(res, "Không tìm thấy dữ liệu", 404);
  if (err.code === "P2002") return fail(res, "Dữ liệu đã tồn tại (duplicate)", 409);
  if (err.name === "ValidationError") return fail(res, err.message, 422);

  if (err.isOperational) return fail(res, err.message, err.statusCode || 400);

  serverError(res, err.message || "Lỗi hệ thống");
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} không tồn tại` });
}

module.exports = { errorHandler, notFoundHandler };
