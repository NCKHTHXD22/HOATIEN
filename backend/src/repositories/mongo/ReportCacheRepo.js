const ReportCache = require("../../models/mongo/ReportCache");

const get = (cacheKey) => ReportCache.findOne({ cacheKey }).lean();

const set = (cacheKey, data, ttlSeconds = 3600) => {
  const expiredAt = new Date(Date.now() + ttlSeconds * 1000);
  return ReportCache.findOneAndUpdate(
    { cacheKey },
    { data, generatedAt: new Date(), ttl: ttlSeconds, expiredAt },
    { upsert: true, new: true }
  );
};

const invalidate = (cacheKey) => ReportCache.deleteOne({ cacheKey });

const invalidateAll = () => ReportCache.deleteMany({});

module.exports = { get, set, invalidate, invalidateAll };
