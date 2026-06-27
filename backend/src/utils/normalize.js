// Chuẩn hóa dữ liệu thành viên trước khi ghi vào Prisma.
// - ngaySinh: "" / thiếu → null; "YYYY-MM-DD" hoặc ISO → Date (Prisma đòi ISO-8601 đầy đủ)
// - cccd/sdt/email/zaloUserId: "" → null (tránh lỗi trùng unique trên chuỗi rỗng)
function normalizeMember(data = {}) {
  const out = { ...data };

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

module.exports = { normalizeMember };
