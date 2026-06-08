const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const ReportService = require("./ReportService");

// ─── EXCEL ─────────────────────────────────────────────────

async function buildExcelReport(res) {
  const [summary, byVillage, movStats] = await Promise.all([
    ReportService.getTotalSummary(),
    ReportService.getStatsByVillage(),
    ReportService.getMovementStats(),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "UBND Xã Hòa Tiến";
  wb.created = new Date();

  // ── Sheet 1: Tổng quan ──────────────────────────────────
  const s1 = wb.addWorksheet("Tổng quan");

  s1.mergeCells("A1:D1");
  const titleCell = s1.getCell("A1");
  titleCell.value = "BÁO CÁO TỔNG HỢP DÂN SỐ — UBND XÃ HÒA TIẾN";
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center" };

  s1.mergeCells("A2:D2");
  s1.getCell("A2").value = `Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`;
  s1.getCell("A2").alignment = { horizontal: "center" };

  s1.addRow([]);
  const hdr1 = s1.addRow(["Chỉ số", "Giá trị"]);
  styleHeader(hdr1, "#1e40af");

  const kpiRows = [
    ["Tổng hộ dân",       summary.households],
    ["Tổng nhân khẩu",    summary.members],
    ["Số thôn",           summary.villages],
    ["Chuyển đến",        movStats.moveIn],
    ["Chuyển đi",         movStats.moveOut],
    ["Biến động ròng",    movStats.net],
  ];
  kpiRows.forEach(r => {
    const row = s1.addRow(r);
    row.getCell(2).alignment = { horizontal: "right" };
    row.getCell(2).numFmt = "#,##0";
  });

  s1.getColumn(1).width = 24;
  s1.getColumn(2).width = 16;

  // ── Sheet 2: Theo thôn ──────────────────────────────────
  const s2 = wb.addWorksheet("Theo thôn");

  s2.mergeCells("A1:H1");
  const t2 = s2.getCell("A1");
  t2.value = "THỐNG KÊ HỘ DÂN THEO THÔN";
  t2.font = { bold: true, size: 13 };
  t2.alignment = { horizontal: "center" };

  s2.addRow([]);
  const hdr2 = s2.addRow([
    "Thôn", "Mã thôn", "Tổng hộ", "Đang HĐ", "Nhân khẩu",
    "Thường trú", "Tạm trú", "Tạm vắng",
  ]);
  styleHeader(hdr2, "#1e40af");

  byVillage.forEach(v => {
    const row = s2.addRow([
      v.villageName,
      v.ma,
      v.totalHouseholds,
      v.activeHouseholds,
      v.totalMembers,
      v.byType?.THUONG_TRU ?? 0,
      v.byType?.TAM_TRU    ?? 0,
      v.byType?.TAM_VANG   ?? 0,
    ]);
    for (let c = 3; c <= 8; c++) {
      row.getCell(c).alignment = { horizontal: "right" };
      row.getCell(c).numFmt = "#,##0";
    }
  });

  // totals
  const tot = s2.addRow([
    "TỔNG", "",
    byVillage.reduce((a, v) => a + v.totalHouseholds, 0),
    byVillage.reduce((a, v) => a + v.activeHouseholds, 0),
    byVillage.reduce((a, v) => a + v.totalMembers, 0),
    byVillage.reduce((a, v) => a + (v.byType?.THUONG_TRU ?? 0), 0),
    byVillage.reduce((a, v) => a + (v.byType?.TAM_TRU ?? 0), 0),
    byVillage.reduce((a, v) => a + (v.byType?.TAM_VANG ?? 0), 0),
  ]);
  tot.font = { bold: true };
  for (let c = 3; c <= 8; c++) {
    tot.getCell(c).alignment = { horizontal: "right" };
    tot.getCell(c).numFmt = "#,##0";
    tot.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  }

  [20, 12, 10, 10, 12, 12, 10, 10].forEach((w, i) => {
    s2.getColumn(i + 1).width = w;
  });

  // stream to response
  const filename = `bao-cao-hoa-tien-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  await wb.xlsx.write(res);
  res.end();
}

// ─── PDF ───────────────────────────────────────────────────

async function buildPdfReport(res) {
  const [summary, byVillage, movStats] = await Promise.all([
    ReportService.getTotalSummary(),
    ReportService.getStatsByVillage(),
    ReportService.getMovementStats(),
  ]);

  const filename = `bao-cao-hoa-tien-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  const PW = doc.page.width - 80; // printable width

  // ── Header ──────────────────────────────────────────────
  doc.fontSize(16).font("Helvetica-Bold")
    .text("BAO CAO TONG HOP DAN SO", { align: "center" });
  doc.fontSize(12).font("Helvetica")
    .text("UBND Xa Hoa Tien - Huyen Hoa Vang - TP. Da Nang", { align: "center" });
  doc.fontSize(10)
    .text(`Ngay xuat: ${new Date().toLocaleDateString("vi-VN")}`, { align: "center" });
  doc.moveDown(0.8);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.6);

  // ── KPI section ─────────────────────────────────────────
  doc.fontSize(12).font("Helvetica-Bold").text("I. TONG QUAN");
  doc.moveDown(0.4);

  const kpis = [
    ["Tong ho dan",      summary.households],
    ["Tong nhan khau",   summary.members],
    ["So thon",          summary.villages],
    ["Chuyen den",       movStats.moveIn],
    ["Chuyen di",        movStats.moveOut],
    ["Bien dong rong",   movStats.net],
  ];

  kpis.forEach(([label, val]) => {
    const y = doc.y;
    doc.fontSize(10).font("Helvetica").text(label, 40, y, { width: 200 });
    doc.font("Helvetica-Bold").text(String(val), 240, y, { width: 100, align: "right" });
    doc.moveDown(0.3);
  });

  doc.moveDown(0.6);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.6);

  // ── By-village table ────────────────────────────────────
  doc.fontSize(12).font("Helvetica-Bold").text("II. THONG KE THEO THON");
  doc.moveDown(0.5);

  const cols = [
    { label: "Thon",       width: 90 },
    { label: "Tong ho",    width: 55 },
    { label: "Dang HD",    width: 55 },
    { label: "Nhan khau",  width: 65 },
    { label: "Thuong tru", width: 65 },
    { label: "Tam tru",    width: 55 },
    { label: "Tam vang",   width: 55 },
  ];

  // header row
  let x = 40;
  const rowH = 18;
  const startY = doc.y;

  doc.rect(40, startY, PW, rowH).fill("#1e40af");
  cols.forEach(col => {
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold")
      .text(col.label, x + 3, startY + 5, { width: col.width - 6, ellipsis: true });
    x += col.width;
  });
  doc.fillColor("black");

  // data rows
  byVillage.forEach((v, idx) => {
    const rowY = startY + rowH + idx * rowH;
    if (idx % 2 === 0) doc.rect(40, rowY, PW, rowH).fill("#f0f4ff");

    const cells = [
      v.villageName,
      v.totalHouseholds,
      v.activeHouseholds,
      v.totalMembers,
      v.byType?.THUONG_TRU ?? 0,
      v.byType?.TAM_TRU    ?? 0,
      v.byType?.TAM_VANG   ?? 0,
    ];
    let cx = 40;
    cells.forEach((cell, ci) => {
      const isNum = ci > 0;
      doc.fillColor("#111").fontSize(8).font("Helvetica")
        .text(String(cell), cx + 3, rowY + 5, {
          width: cols[ci].width - 6,
          align: isNum ? "right" : "left",
          ellipsis: true,
        });
      cx += cols[ci].width;
    });
  });

  // totals row
  const totY = startY + rowH + byVillage.length * rowH;
  doc.rect(40, totY, PW, rowH).fill("#dbeafe");
  const totCells = [
    "TONG",
    byVillage.reduce((a, v) => a + v.totalHouseholds, 0),
    byVillage.reduce((a, v) => a + v.activeHouseholds, 0),
    byVillage.reduce((a, v) => a + v.totalMembers, 0),
    byVillage.reduce((a, v) => a + (v.byType?.THUONG_TRU ?? 0), 0),
    byVillage.reduce((a, v) => a + (v.byType?.TAM_TRU ?? 0), 0),
    byVillage.reduce((a, v) => a + (v.byType?.TAM_VANG ?? 0), 0),
  ];
  let tx = 40;
  totCells.forEach((cell, ci) => {
    doc.fillColor("#1e40af").fontSize(8).font("Helvetica-Bold")
      .text(String(cell), tx + 3, totY + 5, {
        width: cols[ci].width - 6,
        align: ci > 0 ? "right" : "left",
      });
    tx += cols[ci].width;
  });

  doc.y = totY + rowH + 20;
  doc.fillColor("#555").fontSize(8).font("Helvetica")
    .text("* Bao cao duoc xuat tu He thong Quan ly Ho khau UBND Xa Hoa Tien", { align: "center" });

  doc.end();
}

// ─── Helper ────────────────────────────────────────────────

function styleHeader(row, hexColor) {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexColor.replace("#", "FF") } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF93C5FD" } },
    };
  });
  row.height = 20;
}

module.exports = { buildExcelReport, buildPdfReport };
