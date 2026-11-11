// THAY TOÀN BỘ dữ liệu dân cư thôn Phú Sơn Nam bằng danh sách trong file "phú sơn nam.xlsx".
// File cột: Họ và tên | Tổ | Thôn | Số điện thoại (header dòng 1), KHÔNG có cột chủ hộ/quan hệ
//   → mỗi dòng = 1 hộ + 1 nhân khẩu (chủ hộ), soNhanKhau = 1.
// XOÁ dữ liệu cũ của thôn trước khi nhập — có SAO LƯU JSON và cố nối lại liên kết Zalo theo tên (+SĐT).
// Dry-run mặc định; thêm --commit để thực hiện. PHẢI chạy trên VPS (DB production).
//   node scripts/importRosterPhuSonNam.js "<file.xlsx>" [--commit]
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { connectDatabases, disconnectDatabases, prisma } = require("../src/config/database");
const ZaloFollowerRepo = require("../src/repositories/mongo/ZaloFollowerRepo");
const { normalizeMember, toProperName } = require("../src/utils/normalize");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const COMMIT = process.argv.includes("--commit");
const EXCEL_PATH = args[0] || "roster_psn.xlsx";
const VILLAGE_NAME = "Phú Sơn Nam";
const DEFAULT_PREFIX = "PSN";

const pad3 = (n) => String(n).padStart(3, "0");
const nameKey = (s) => (s || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
const cellStr = (c) => {
  let v = c && c.value;
  if (v && typeof v === "object" && v.text) v = v.text;
  if (v && typeof v === "object" && v.result !== undefined) v = v.result;
  return v == null ? "" : String(v).replace(/\s+/g, " ").trim();
};
function cleanPhone(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/[^\d]/g, "");
  if (/^\d{9}$/.test(s)) s = "0" + s; // Excel làm mất số 0 đầu
  return /^0\d{9}$/.test(s) ? s : null;
}

async function readRows() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(EXCEL_PATH));
  const ws = wb.worksheets[0];
  const out = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const g = ws.getRow(r);
    const name = cellStr(g.getCell(1));
    if (!name || /^(stt|họ và tên)/i.test(name)) continue;
    const to = (cellStr(g.getCell(2)).match(/tổ\s*(\d+)/i) || [])[1];
    const sdtRaw = cellStr(g.getCell(4));
    out.push({ hoTen: toProperName(name), to: to ? `Tổ ${to}` : null, sdtRaw, sdt: cleanPhone(sdtRaw) });
  }
  return out;
}

async function main() {
  await connectDatabases();
  console.log(`Đọc: ${EXCEL_PATH}`);
  const rows = await readRows();
  console.log(`Người trong file: ${rows.length} (mỗi người = 1 hộ)`);
  console.log(`Không SĐT: ${rows.filter((r) => !r.sdt).length} · SĐT sai định dạng (để trống): ${rows.filter((r) => r.sdtRaw && !r.sdt).length} · không rõ tổ: ${rows.filter((r) => !r.to).length}`);
  const byTo = {}; rows.forEach((r) => { byTo[r.to || "?"] = (byTo[r.to || "?"] || 0) + 1; });
  console.log(`Theo tổ: ${Object.entries(byTo).sort().map(([k, v]) => `${k}=${v}`).join(", ")}`);

  const village = await prisma.village.findFirst({ where: { ten: { contains: VILLAGE_NAME, mode: "insensitive" } } });
  if (!village) throw new Error(`Không tìm thấy thôn ${VILLAGE_NAME}`);

  const oldHh = await prisma.household.findMany({ where: { villageId: village.id }, include: { members: true } });
  const oldMems = oldHh.flatMap((h) => h.members);
  const zaloLinked = oldMems.filter((m) => m.zaloUserId).map((m) => ({ zaloUserId: m.zaloUserId, hoTen: m.hoTen, sdt: m.sdt }));
  let prefix = DEFAULT_PREFIX;
  for (const h of oldHh) { const m = (h.soHoKhau || "").match(/^(.*)-(\d+)$/); if (m) { prefix = m[1]; break; } }

  console.log(`\n=== SẼ XOÁ (thôn ${village.ten}, mã ${village.ma}) ===`);
  console.log(`${oldHh.length} hộ · ${oldMems.length} nhân khẩu · ${zaloLinked.length} liên kết Zalo (sẽ cố nối lại theo tên)`);
  console.log(`\n=== SẼ TẠO ===`);
  console.log(`${rows.length} hộ (mã ${prefix}-001 … ${prefix}-${pad3(rows.length)}), mỗi hộ 1 chủ hộ`);
  console.log(`5 mẫu:`);
  rows.slice(0, 5).forEach((r, i) => console.log(`  ${prefix}-${pad3(i + 1)} | ${r.to || "(chưa rõ tổ)"} | ${r.hoTen} | ${r.sdt || "kSĐT"}`));

  if (!COMMIT) {
    console.log(`\n[DRY RUN] Chưa ghi gì vào DB. Thêm --commit để thực hiện.`);
    await disconnectDatabases();
    return;
  }

  const backup = path.resolve(`backup_${prefix}_${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify({ village, households: oldHh }, null, 2), "utf8");
  console.log(`\nĐã sao lưu dữ liệu cũ: ${backup}`);

  const hhIds = oldHh.map((h) => h.id);
  const memIds = oldMems.map((m) => m.id);
  await prisma.$transaction(async (tx) => {
    if (memIds.length) {
      await tx.notificationSend.deleteMany({ where: { memberId: { in: memIds } } });
      await tx.member.deleteMany({ where: { id: { in: memIds } } });
    }
    if (hhIds.length) await tx.household.deleteMany({ where: { id: { in: hhIds } } });
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      await tx.household.create({
        data: {
          soHoKhau: `${prefix}-${pad3(i + 1)}`,
          diaChi: [r.to, VILLAGE_NAME, "Xã Hòa Tiến"].filter(Boolean).join(", "),
          to: r.to,
          villageId: village.id,
          loaiHo: "THUONG_TRU",
          soNhanKhau: 1,
          members: { create: normalizeMember({ hoTen: r.hoTen, sdt: r.sdt, quanHeChuHo: "Chủ hộ", laChuHo: true }) },
        },
      });
    }
  }, { timeout: 300000 });
  console.log(`Đã xoá ${oldHh.length} hộ cũ · tạo ${rows.length} hộ mới.`);

  // Nối lại Zalo: ưu tiên trùng tên + SĐT, sau đó trùng tên (file có nhiều tên trùng nhau).
  let relinked = 0, cleared = 0;
  for (const z of zaloLinked) {
    const base = { household: { villageId: village.id }, hoTen: { equals: z.hoTen, mode: "insensitive" }, zaloUserId: null };
    const m = (z.sdt && (await prisma.member.findFirst({ where: { ...base, sdt: z.sdt }, select: { id: true } })))
      || (await prisma.member.findFirst({ where: base, select: { id: true } }));
    if (m) {
      await prisma.member.update({ where: { id: m.id }, data: { zaloUserId: z.zaloUserId } });
      await ZaloFollowerRepo.setLink(z.zaloUserId, m.id);
      relinked++;
    } else {
      await ZaloFollowerRepo.setLink(z.zaloUserId, null);
      cleared++;
      console.log(`  ! mất liên kết Zalo: ${z.hoTen}${z.sdt ? " " + z.sdt : ""}`);
    }
  }
  console.log(`Zalo: nối lại ${relinked} · gỡ ${cleared}`);
  await disconnectDatabases();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
