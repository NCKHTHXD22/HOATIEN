const SearchIndexRepo = require("../repositories/mongo/SearchIndexRepo");
const HouseholdRepo = require("../repositories/pg/HouseholdRepo");
const { prisma } = require("../config/database");
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

// Tìm trên PostgreSQL: khớp MỘT PHẦN, không phân biệt hoa/thường + KHÔNG phân biệt dấu (unaccent).
// Ưu tiên: khớp tên chủ hộ > tên thành viên khác > số HK/địa chỉ/SĐT/CCCD.
// opts.chuHo = true -> chỉ tìm theo tên chủ hộ. Trả về mảng householdId đã xếp hạng.
async function searchByText(query, opts = {}) {
  const q = String(query || "").trim();
  if (!q) return [];
  const like = "%" + q.replace(/[%_\\]/g, "\\$&") + "%";
  try {
    const rows = opts.chuHo
      ? await prisma.$queryRaw`
          SELECT h.id
          FROM households h
          JOIN members m ON m."householdId" = h.id AND m."laChuHo" = true
          WHERE unaccent(lower(m."hoTen")) LIKE unaccent(lower(${like}))
          GROUP BY h.id
          LIMIT 30`
      : await prisma.$queryRaw`
          SELECT h.id, MAX(CASE
              WHEN m."laChuHo" = true AND unaccent(lower(m."hoTen")) LIKE unaccent(lower(${like})) THEN 3
              WHEN unaccent(lower(coalesce(m."hoTen", ''))) LIKE unaccent(lower(${like})) THEN 2
              ELSE 1 END) AS rank
          FROM households h
          LEFT JOIN members m ON m."householdId" = h.id
          WHERE unaccent(lower(h."soHoKhau")) LIKE unaccent(lower(${like}))
             OR unaccent(lower(h."diaChi")) LIKE unaccent(lower(${like}))
             OR unaccent(lower(coalesce(m."hoTen", ''))) LIKE unaccent(lower(${like}))
             OR coalesce(m.sdt, '') LIKE ${like}
             OR coalesce(m.cccd, '') LIKE ${like}
          GROUP BY h.id
          ORDER BY rank DESC
          LIMIT 30`;
    return rows.map((r) => r.id);
  } catch (err) {
    // Dự phòng nếu thiếu extension unaccent: tìm không phân biệt hoa/thường (còn phân biệt dấu)
    logger.error(`SearchService.searchByText unaccent failed, fallback: ${err.message}`);
    const where = opts.chuHo
      ? { members: { some: { laChuHo: true, hoTen: { contains: q, mode: "insensitive" } } } }
      : {
          OR: [
            { soHoKhau: { contains: q, mode: "insensitive" } },
            { diaChi: { contains: q, mode: "insensitive" } },
            { members: { some: { OR: [
              { hoTen: { contains: q, mode: "insensitive" } },
              { sdt: { contains: q } },
              { cccd: { contains: q } },
            ] } } },
          ],
        };
    const hs = await prisma.household.findMany({ where, select: { id: true }, take: 30 });
    return hs.map((h) => h.id);
  }
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
