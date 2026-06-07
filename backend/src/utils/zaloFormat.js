function formatZaloReply(households) {
  if (!households || households.length === 0) {
    return "Không tìm thấy hộ dân nào phù hợp. Vui lòng thử lại với thông tin khác.";
  }

  const lines = households.slice(0, 10).map((h, i) => {
    const chuHo = h.members?.find((m) => m.laChuHo)?.hoTen || "Chưa xác định";
    const soThanhVien = h.members?.length || 0;
    const thon = h.village?.ten || "Chưa rõ";
    return `${i + 1}. ${chuHo} — ${thon} — ${soThanhVien} nhân khẩu`;
  });

  const more = households.length > 10 ? `\n(và ${households.length - 10} kết quả khác...)` : "";
  return `Tìm thấy ${households.length} hộ:\n${lines.join("\n")}${more}`;
}

function formatZaloHouseholdDetail(h) {
  const chuHo = h.members?.find((m) => m.laChuHo)?.hoTen || "Chưa xác định";
  const soThanhVien = h.members?.length || 0;
  return (
    `Hộ: ${h.soHoKhau}\n` +
    `Chủ hộ: ${chuHo}\n` +
    `Địa chỉ: ${h.diaChi}\n` +
    `Thôn: ${h.village?.ten || ""}\n` +
    `Số nhân khẩu: ${soThanhVien}`
  );
}

module.exports = { formatZaloReply, formatZaloHouseholdDetail };
