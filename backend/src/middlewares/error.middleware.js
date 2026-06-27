const logger = require("../utils/logger");
const { serverError, fail } = require("../utils/response");

function errorHandler(err, req, res, _next) {
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });

  if (err.code === "P2025") return fail(res, "Không tìm thấy dữ liệu", 404);
  if (err.code === "P2002") return fail(res, "Dữ liệu đã tồn tại (duplicate)", 409);
  if (err.code === "P2003") return fail(res, "Không thể thực hiện vì dữ liệu này vẫn đang được dữ liệu khác tham chiếu tới", 409);
  if (err.name === "ValidationError") return fail(res, err.message, 422);

  if (err.isOperational) return fail(res, err.message, err.statusCode || 400);

  // Lỗi DB thô (FK constraint, ConnectorError...) không được lọt ra ngoài cho người dùng thấy
  if (/ConnectorError|PostgresError|foreign key constraint|violates.*constraint/i.test(err.message || "")) {
    return fail(res, "Không thể thực hiện vì dữ liệu này vẫn đang được dữ liệu khác tham chiếu tới", 409);
  }

  serverError(res, err.message || "Lỗi hệ thống");
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} không tồn tại` });
}

module.exports = { errorHandler, notFoundHandler };
