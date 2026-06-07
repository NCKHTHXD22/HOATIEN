const SearchIndex = require("../../models/mongo/SearchIndex");

const upsert = (householdId, data) =>
  SearchIndex.findOneAndUpdate(
    { householdId },
    { ...data, updatedAt: new Date() },
    { upsert: true, new: true }
  );

const searchByText = (query, limit = 20) =>
  SearchIndex.find({ $text: { $search: query } }, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .lean();

const deleteByHouseholdId = (householdId) =>
  SearchIndex.deleteOne({ householdId });

const findAll = () => SearchIndex.find().lean();

const buildTokens = (household) => {
  const tokens = [];
  if (household.diaChi) tokens.push(...household.diaChi.split(" "));
  if (household.village?.ten) tokens.push(household.village.ten);
  if (household.members) {
    for (const m of household.members) {
      if (m.hoTen) tokens.push(...m.hoTen.split(" "));
    }
  }
  return [...new Set(tokens.map((t) => t.toLowerCase()))];
};

module.exports = { upsert, searchByText, deleteByHouseholdId, findAll, buildTokens };
