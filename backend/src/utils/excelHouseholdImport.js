// Parser Excel "Danh sách khảo sát tiêu chí hộ gia đình" (định dạng thôn/tổ của xã Hòa Tiến)
// → nhóm thành Hộ + Nhân khẩu. Chỉ lấy dữ liệu dân cư cốt lõi (bỏ qua các cột khảo sát chuyển đổi số).
const ExcelJS = require("exceljs");

const NO_INFO = "Không có thông tin";
const pad3 = (n) => String(n).padStart(3, "0");
const deaccent = (s) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
const norm = (s) => deaccent(s).toLowerCase().trim();
// Dòng chủ hộ: quan hệ "Chủ" hoặc "Chủ hộ" (so khớp CÓ DẤU để không lẫn "Chú" = chú/cậu)
const isHead = (rel) => { const q = String(rel || "").normalize("NFC").toLowerCase().trim(); return q === "chủ" || q.startsWith("chủ h"); };

// Lấy giá trị text từ 1 cell (xử lý richText / hyperlink / formula / Date)
function cellStr(cell) {
  let v = cell?.value;
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.richText) v = v.richText.map((t) => t.text).join("");
    else if (v.text !== undefined) v = v.text;
    else if (v.result !== undefined) v = v.result;
    else if (v instanceof Date) return v; // trả nguyên Date cho parseDob
    else v = "";
  }
  return String(v).trim();
}

// "1/12/1985" | "03/9/1973" | "1990" | Date → { iso, warn }
function parseDob(raw) {
  if (raw instanceof Date && !isNaN(raw)) {
    const y = raw.getFullYear(), m = raw.getMonth() + 1, d = raw.getDate();
    return { iso: `${y}-${pad3(m).slice(1)}-${pad3(d).slice(1)}`, warn: null };
  }
  const s = String(raw || "").trim();
  if (!s) return { iso: null, warn: null };
  if (/^\d{4}$/.test(s)) return { iso: `${s}-01-01`, warn: `Chỉ có năm sinh "${s}", tạm lưu 01/01/${s}` };
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); // d/m/yyyy
  if (m) {
    const d = +m[1], mo = +m[2], y = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { iso: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, warn: null };
    return { iso: null, warn: `Ngày sinh không hợp lệ "${s}"` };
  }
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/); // yyyy-m-d
  if (m) return { iso: `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`, warn: null };
  return { iso: null, warn: `Không đọc được ngày sinh "${s}"` };
}

// "Nam" → NAM, "Nữ" → NU, khác → KHAC, trống → null
function parseGender(raw) {
  const n = norm(raw);
  if (!n) return null;
  if (n === "nam") return "NAM";
  if (n === "nu") return "NU";
  return "KHAC";
}

// CCCD: bỏ khoảng trắng/dấu chấm; hợp lệ = 9 hoặc 12 chữ số; sai → null + cảnh báo
function cleanCccd(raw) {
  const s = String(raw || "").replace(/[\s.\-]/g, "").trim();
  if (!s) return { cccd: null, warn: null };
  if (!/^\d{9}$|^\d{12}$/.test(s)) return { cccd: null, warn: `CCCD không hợp lệ "${raw}"` };
  return { cccd: s, warn: null };
}

const HEADER_KW = ["ho va ten", "ho ten", "ngay thang", "ngay sinh", "chu ho", "quan he", "noi thuong tru", "so dien thoai", "gioi tinh", "cccd", "can cuoc", "tong cong", "nhan khau", "stt"];
const isHeaderish = (t) => { const n = norm(t); return !n || HEADER_KW.some((k) => n.includes(k)) || /^\d+$/.test(n); };

// Dò cột theo từ khóa header (fallback vị trí cố định của mẫu xã Hòa Tiến) + dòng header cuối
function detectColumns(ws) {
  // gioiTinh/cccd mặc định 0 = không có (chỉ đọc khi dò thấy tiêu đề)
  const col = { hoStt: 1, hoTen: 3, ngaySinh: 4, quanHe: 5, to: 6, sdt: 7, gioiTinh: 0, cccd: 0, headerRow: 0 };
  for (let r = 1; r <= Math.min(12, ws.rowCount); r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= Math.min(30, ws.columnCount); c++) {
      const n = norm(cellStr(row.getCell(c)));
      if (!n) continue;
      if (n === "ho") col.hoStt = c;
      else if (n.includes("ho va ten") || n === "ho ten") { col.hoTen = c; col.headerRow = Math.max(col.headerRow, r); }
      else if (n.includes("ngay") && n.includes("sinh")) col.ngaySinh = c;
      else if (n.includes("gioi tinh")) col.gioiTinh = c;
      else if (n.includes("cccd") || n.includes("can cuoc")) col.cccd = c;
      else if (n.includes("quan he")) col.quanHe = c;
      else if (n.includes("thuong tru") || (n.includes("noi") && n.includes("tru"))) col.to = c;
      else if (n.includes("so dien thoai")) col.sdt = c; // "số điện thoại" — tránh trùng cột khảo sát "điện thoại thông minh"
    }
  }
  return col;
}

function detectVillageName(ws) {
  for (let r = 1; r <= Math.min(6, ws.rowCount); r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= Math.min(6, ws.columnCount); c++) {
      const t = cellStr(row.getCell(c));
      const m = String(t).match(/th[ôo]n\s+(.+)$/i);
      if (m) {
        const words = m[1].trim().split(/\s+/).map((w) => w.charAt(0).toLocaleUpperCase("vi") + w.slice(1).toLocaleLowerCase("vi"));
        return "Thôn " + words.join(" ");
      }
    }
  }
  return "";
}

function villageMa(villageName) {
  const base = deaccent(villageName).replace(/th[ôo]n/i, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return base || "THON";
}

async function parseHouseholdExcel(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets.find((w) => w.rowCount > 1) || wb.worksheets[0];
  if (!ws) throw new Error("File Excel không có sheet dữ liệu");

  const C = detectColumns(ws);
  const villageName = detectVillageName(ws);
  const warnings = [];
  const households = [];
  let cur = null;
  let toGuess = "";

  for (let r = C.headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = cellStr(row.getCell(C.hoTen));
    if (!name || isHeaderish(name)) continue; // bỏ tiêu đề, dòng đánh số, dòng trống
    // Dừng khi tới phần thống kê/tổng hợp cuối bảng
    if (/tong cong|tong hop|tong so|bang tong/.test(norm(name))) break;

    const quanHe = cellStr(row.getCell(C.quanHe));
    const hoStt = cellStr(row.getCell(C.hoStt));
    const head = isHead(quanHe);
    // Hộ mới = có số thứ tự ở cột "Hộ". (Chủ hộ có thể nằm ở BẤT KỲ dòng nào trong hộ,
    // vì file đặt số ở người liệt kê đầu tiên — không nhất thiết là chủ hộ.)
    if (String(hoStt).trim() || !cur) {
      cur = { stt: String(hoStt).trim(), to: "", members: [] };
      households.push(cur);
    }

    const to = cellStr(row.getCell(C.to));
    if (to && !cur.to) cur.to = to;
    if (to && !toGuess) toGuess = to;

    const { iso, warn } = parseDob(row.getCell(C.ngaySinh).value instanceof Date ? row.getCell(C.ngaySinh).value : cellStr(row.getCell(C.ngaySinh)));
    if (warn) warnings.push({ row: r, name, msg: warn });

    const gioiTinh = C.gioiTinh ? parseGender(cellStr(row.getCell(C.gioiTinh))) : null;
    let cccd = null;
    if (C.cccd) {
      const cc = cleanCccd(cellStr(row.getCell(C.cccd)));
      cccd = cc.cccd;
      if (cc.warn) warnings.push({ row: r, name, msg: cc.warn });
    }

    cur.members.push({
      hoTen: name,
      ngaySinh: iso,
      gioiTinh,
      cccd,
      quanHeChuHo: quanHe || NO_INFO,
      laChuHo: head,
      sdt: cellStr(row.getCell(C.sdt)) || null,
    });
  }

  // Chống trùng CCCD NGAY TRONG FILE (giữ người đầu, người sau để trống)
  const seenCccd = new Set();
  for (const h of households) for (const m of h.members) {
    if (!m.cccd) continue;
    if (seenCccd.has(m.cccd)) { warnings.push({ row: null, name: m.hoTen, msg: `CCCD ${m.cccd} bị trùng trong file → để trống` }); m.cccd = null; }
    else seenCccd.add(m.cccd);
  }

  // Đảm bảo mỗi hộ có đúng 1 chủ hộ
  for (const h of households) {
    const heads = h.members.filter((m) => m.laChuHo);
    if (heads.length === 0 && h.members.length) {
      h.members[0].laChuHo = true;
      h.members[0].quanHeChuHo = "Chủ hộ";
      warnings.push({ row: null, name: h.members[0].hoTen, msg: "Hộ không ghi 'Chủ hộ' → lấy người đầu tiên làm chủ hộ" });
    } else if (heads.length > 1) {
      heads.slice(1).forEach((m) => { m.laChuHo = false; });
      warnings.push({ row: null, name: heads[0].hoTen, msg: `Hộ có ${heads.length} người ghi 'Chủ hộ' → giữ người đầu` });
    }
  }

  const emptyHouseholds = households.filter((h) => h.members.length === 0);
  const cleaned = households.filter((h) => h.members.length > 0);
  const memberCount = cleaned.reduce((s, h) => s + h.members.length, 0);

  return {
    villageName,
    villageMaSuggest: villageMa(villageName),
    to: toGuess,
    households: cleaned,
    householdCount: cleaned.length,
    memberCount,
    warnings,
    _meta: { columns: C, emptyHouseholds: emptyHouseholds.length },
  };
}

module.exports = { parseHouseholdExcel, villageMa, parseDob };
