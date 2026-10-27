// THAY TOÀN BỘ dữ liệu dân cư thôn Phú Sơn bằng "danh sách chủ hộ phú sơn.xlsx" (Sheet1).
// File là danh sách HỘ: mỗi dòng = 1 chủ hộ (STT | họ tên | tổ | ngày sinh | CCCD | SĐT)
//   → tạo hộ + 1 nhân khẩu (chủ hộ).
// XOÁ dữ liệu cũ của thôn trước khi nhập — có SAO LƯU JSON và cố nối lại liên kết Zalo theo tên (rồi SĐT).
// Dry-run mặc định; thêm --commit để thực hiện.
//   node scripts/importRosterPhuSon.js "<file.xlsx>" [--commit]
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { connectDatabases, disconnectDatabases, prisma } = require("../src/config/database");
const ZaloFollowerRepo = require("../src/repositories/mongo/ZaloFollowerRepo");
const { normalizeMember, toProperName } = require("../src/utils/normalize");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const COMMIT = process.argv.includes("--commit");
const EXCEL_PATH = args[0] || "roster_ps.xlsx";
const VILLAGE_NAME = "Phú Sơn";
const PREFIX = "PS";

const pad3 = (n) => String(n).padStart(3, "0");
const cellVal = (c) => {
  let v = c && c.value;
  if (v && typeof v === "object" && v.text) v = v.text;
  if (v && typeof v === "object" && v.result !== undefined) v = v.result;
  return v;
};
const cellStr = (c) => {
  const v = cellVal(c);
  return v == null ? "" : String(v).replace(/\s+/g, " ").trim();
};
function cleanPhone(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/[^\d]/g, "");
  if (/^\d{9}$/.test(s)) s = "0" + s; // Excel làm mất số 0 đầu
  return /^0\d{9}$/.test(s) ? s : null;
}
function cleanCccd(raw) {
  let s = String(raw ?? "").replace(/[^\d]/g, "");
  if (/^\d{11}$/.test(s)) s = "0" + s; // Excel làm mất số 0 đầu
  return /^\d{12}$/.test(s) ? s : null;
}
function parseDob(v) {
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + v * 86400000); // serial Excel
  const m = String(v ?? "").trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  const y = String(v ?? "").trim().match(/^(\d{4})$/);
  return y ? new Date(Date.UTC(+y[1], 0, 1)) : null;
}

async function readRows() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(EXCEL_PATH));
  const ws = wb.worksheets[0];
  const out = [];
  for (let r = 3; r <= ws.rowCount; r++) {
    const g = ws.getRow(r);
    const name = cellStr(g.getCell(2));
    if (!name || /^(stt|họ và tên)/i.test(name)) continue;
    const to = cellStr(g.getCell(3)).replace(/[^\d]/g, "");
    const dobRaw = cellVal(g.getCell(4));
    out.push({
      hoTen: toProperName(name),
      to: to ? `Tổ ${parseInt(to, 10)}` : null,
      ngaySinh: parseDob(dobRaw),
      dobRaw: cellStr(g.getCell(4)),
      cccd: cleanCccd(cellStr(g.getCell(5))),
      cccdRaw: cellStr(g.getCell(5)),
      sdt: cleanPhone(cellStr(g.getCell(6))),
    });
  }
  return out;
}

async function main() {
  await connectDatabases();
  console.log(`Đọc: ${EXCEL_PATH}`);
  const rows = await readRows();
  console.log(`Hộ trong file: ${rows.length}`);
  console.log(`Không SĐT: ${rows.filter((r) => !r.sdt).length} · không rõ tổ: ${rows.filter((r) => !r.to).length} · có CCCD: ${rows.filter((r) => r.cccd).length} · có ngày sinh: ${rows.filter((r) => r.ngaySinh).length}`);
  const badDob = rows.filter((r) => r.dobRaw && !r.ngaySinh);
  const badCccd = rows.filter((r) => r.cccdRaw && !r.cccd);
  if (badDob.length) console.log(`  ! ngày sinh không đọc được (bỏ trống): ${badDob.map((r) => `${r.hoTen}="${r.dobRaw}"`).join(", ")}`);
  if (badCccd.length) console.log(`  ! CCCD sai định dạng (bỏ trống): ${badCccd.map((r) => `${r.hoTen}="${r.cccdRaw}"`).join(", ")}`);

  const village = await prisma.village.findFirst({ where: { ten: VILLAGE_NAME } });
  if (!village) throw new Error(`Không tìm thấy thôn ${VILLAGE_NAME}`);

  const oldHh = await prisma.household.findMany({ where: { villageId: village.id }, include: { members: true } });
  const oldMems = oldHh.flatMap((h) => h.members);
  const zaloLinked = oldMems.filter((m) => m.zaloUserId).map((m) => ({ zaloUserId: m.zaloUserId, hoTen: m.hoTen, sdt: m.sdt }));

  // CCCD là @unique: trùng trong file hoặc trùng người ở thôn khác → bỏ trống CCCD dòng đó
  const seen = new Map();
  for (const r of rows) {
    if (!r.cccd) continue;
    if (seen.has(r.cccd)) { console.log(`  ! CCCD trùng trong file ${r.cccd}: ${seen.get(r.cccd)} / ${r.hoTen} → bỏ CCCD dòng sau`); r.cccd = null; }
    else seen.set(r.cccd, r.hoTen);
  }
  const elsewhere = await prisma.member.findMany({
    where: { cccd: { in: rows.filter((r) => r.cccd).map((r) => r.cccd) }, household: { villageId: { not: village.id } } },
    select: { cccd: true, hoTen: true, household: { select: { soHoKhau: true } } },
  });
  for (const e of elsewhere) {
    const r = rows.find((x) => x.cccd === e.cccd);
    console.log(`  ! CCCD ${e.cccd} của ${r.hoTen} đã thuộc ${e.hoTen} (${e.household.soHoKhau}) thôn khác → bỏ CCCD`);
    r.cccd = null;
  }

  console.log(`\n=== SẼ XOÁ (thôn ${village.ten}) ===`);
  console.log(`${oldHh.length} hộ · ${oldMems.length} nhân khẩu · ${zaloLinked.length} liên kết Zalo (sẽ cố nối lại theo tên/SĐT)`);
  console.log(`\n=== SẼ TẠO ===`);
  console.log(`${rows.length} hộ (mã ${PREFIX}-001 … ${PREFIX}-${pad3(rows.length)}), mỗi hộ 1 chủ hộ`);
  console.log(`5 mẫu:`);
  rows.slice(0, 5).forEach((r, i) => console.log(`  ${PREFIX}-${pad3(i + 1)} | ${r.to || "(chưa rõ tổ)"} | ${r.hoTen} | ${r.ngaySinh ? r.ngaySinh.toISOString().slice(0, 10) : "kNS"} | ${r.cccd || "kCCCD"} | ${r.sdt || "kSĐT"}`));

  if (!COMMIT) {
    console.log(`\n[DRY RUN] Chưa ghi gì vào DB. Thêm --commit để thực hiện.`);
    await disconnectDatabases();
    return;
  }

  const backup = path.resolve(`backup_${PREFIX}_${Date.now()}.json`);
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
          soHoKhau: `${PREFIX}-${pad3(i + 1)}`,
          diaChi: [r.to, VILLAGE_NAME, "Xã Hòa Tiến"].filter(Boolean).join(", "),
          to: r.to,
          villageId: village.id,
          loaiHo: "THUONG_TRU",
          soNhanKhau: 1,
          members: {
            create: normalizeMember({ hoTen: r.hoTen, ngaySinh: r.ngaySinh, cccd: r.cccd, sdt: r.sdt, quanHeChuHo: "Chủ hộ", laChuHo: true }),
          },
        },
      });
    }
  }, { timeout: 300000 });
  console.log(`Đã xoá ${oldHh.length} hộ cũ · tạo ${rows.length} hộ mới.`);

  let relinked = 0, cleared = 0;
  for (const z of zaloLinked) {
    const inVillage = { household: { villageId: village.id }, zaloUserId: null };
    let m = await prisma.member.findFirst({ where: { ...inVillage, hoTen: { equals: z.hoTen, mode: "insensitive" } }, select: { id: true } });
    if (!m && z.sdt) m = await prisma.member.findFirst({ where: { ...inVillage, sdt: z.sdt }, select: { id: true } });
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
