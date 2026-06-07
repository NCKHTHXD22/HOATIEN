const AuthService = require("../services/AuthService");
const { unauthorized, forbidden } = require("../utils/response");

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return unauthorized(res);

  try {
    const payload = await AuthService.verifyToken(header.slice(7));
    req.user = payload;
    next();
  } catch {
    unauthorized(res, "Token không hợp lệ hoặc đã hết hạn");
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return unauthorized(res);
    if (!roles.includes(req.user.role)) return forbidden(res, "Không có quyền thực hiện");
    next();
  };
}

module.exports = { authenticate, requireRole };
