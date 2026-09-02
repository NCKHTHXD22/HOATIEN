// Chuẩn hóa họ tên tiếng Việt về dạng chuẩn: mỗi từ viết hoa chữ đầu.
// VD: "BÙI CHINH" / "nguyễn văn a" → "Bùi Chinh" / "Nguyễn Văn A"
function toProperName(str) {
  if (typeof str !== "string") return str;
  return str
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    // viết hoa chữ cái đầu mỗi từ, bỏ qua dấu câu đứng trước (VD "(t)" → "(T)")
    .replace(/(^|\s)(\p{P}*)(\p{L})/gu, (_, sp, p, ch) => sp + p + ch.toUpperCase());
}

// Chuẩn hóa dữ liệu thành viên trước khi ghi vào Prisma.
// - hoTen: chuẩn hóa về title-case tiếng Việt
// - ngaySinh: "" / thiếu → null; "YYYY-MM-DD" hoặc ISO → Date (Prisma đòi ISO-8601 đầy đủ)
// - cccd/sdt/email/zaloUserId: "" → null (tránh lỗi trùng unique trên chuỗi rỗng)
function normalizeMember(data = {}) {
  const out = { ...data };

  if (typeof out.hoTen === "string") {
    out.hoTen = toProperName(out.hoTen);
  }

  if ("ngaySinh" in out) {
    out.ngaySinh = out.ngaySinh ? new Date(out.ngaySinh) : null;
  }

  for (const f of ["cccd", "sdt", "email", "zaloUserId"]) {
    if (f in out && typeof out[f] === "string") {
      out[f] = out[f].trim() || null;
    } else if (f in out && out[f] == null) {
      out[f] = null;
    }
  }

  if (out.laChuHo && !String(out.quanHeChuHo || "").trim()) {
    out.quanHeChuHo = "Chủ hộ";
  }

  return out;
}

module.exports = { normalizeMember, toProperName };
