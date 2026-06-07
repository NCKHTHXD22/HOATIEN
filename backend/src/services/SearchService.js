const SearchIndexRepo = require("../repositories/mongo/SearchIndexRepo");
const HouseholdRepo = require("../repositories/pg/HouseholdRepo");
const logger = require("../utils/logger");

async function syncIndex(householdId) {
  try {
    const household = await HouseholdRepo.findById(householdId);
    if (!household) { await SearchIndexRepo.deleteByHouseholdId(householdId); return; }
    const tokens = SearchIndexRepo.buildTokens(household);
    await SearchIndexRepo.upsert(householdId, {
      soHoKhau: household.soHoKhau,
      chuHoName: household.members?.find((m) => m.laChuHo)?.hoTen || "",
      villageName: household.village?.ten || "",
      villageId: household.villageId,
      tokens,
    });
  } catch (err) {
    logger.error(`SearchService.syncIndex failed [${householdId}]: ${err.message}`);
  }
}

async function searchByText(query) {
  const results = await SearchIndexRepo.searchByText(query);
  return results.map((r) => r.householdId);
}

async function fullResync() {
  logger.info("SearchService: starting full re-sync...");
  const [households] = await HouseholdRepo.findAll({ limit: 9999 });
  let count = 0;
  for (const h of households) {
    await syncIndex(h.id);
    count++;
  }
  logger.info(`SearchService: full re-sync done — ${count} records`);
}

module.exports = { syncIndex, searchByText, fullResync };
