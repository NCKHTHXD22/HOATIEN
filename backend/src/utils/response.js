const ok = (res, data, message = "Success", statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const created = (res, data, message = "Created") =>
  ok(res, data, message, 201);

const fail = (res, message = "Bad Request", statusCode = 400, errors = null) =>
  res.status(statusCode).json({ success: false, message, ...(errors && { errors }) });

const notFound = (res, message = "Not found") => fail(res, message, 404);

const unauthorized = (res, message = "Unauthorized") => fail(res, message, 401);

const forbidden = (res, message = "Forbidden") => fail(res, message, 403);

const serverError = (res, message = "Internal server error") =>
  fail(res, message, 500);

const paginated = (res, data, total, page, limit) =>
  res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    },
  });

module.exports = { ok, created, fail, notFound, unauthorized, forbidden, serverError, paginated };
