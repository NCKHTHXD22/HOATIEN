const ZaloSession = require("../../models/mongo/ZaloSession");

const TTL_MINUTES = 30;

const getOrCreate = (zaloUserId) =>
  ZaloSession.findOneAndUpdate(
    { zaloUserId },
    { $setOnInsert: { zaloUserId, state: "IDLE", expiredAt: _ttl() } },
    { upsert: true, new: true }
  );

const updateState = (zaloUserId, patch) =>
  ZaloSession.findOneAndUpdate(
    { zaloUserId },
    { ...patch, expiredAt: _ttl() },
    { upsert: true, new: true }
  );

const reset = (zaloUserId) =>
  ZaloSession.findOneAndUpdate(
    { zaloUserId },
    { state: "IDLE", queryType: null, lastQuery: null, resultCount: 0, context: {}, expiredAt: _ttl() },
    { upsert: true, new: true }
  );

const _ttl = () => new Date(Date.now() + TTL_MINUTES * 60 * 1000);

module.exports = { getOrCreate, updateState, reset };
