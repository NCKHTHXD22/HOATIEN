const { validationResult } = require("express-validator");
const { fail } = require("../utils/response");

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, "Dữ liệu không hợp lệ", 422, errors.array());
  }
  next();
}

module.exports = { validate };
