// Luồng thu thập phản ánh qua chatbot Zalo (port từ An Hải, adapt cho HOATIEN)
const { sendText } = require("../utils/zaloBroadcast");
const { uploadFromUrl, uploadFromZaloImageUrl } = require("../utils/cloudinaryUpload");
const ZaloFollowerRepo = require("../repositories/mongo/ZaloFollowerRepo");
const Feedback = require("../models/mongo/Feedback");
const Category = require("../models/mongo/Category");
const { setState, getState, clearState } = require("./chatState");
const logger = require("../utils/logger");

const MAX_IMAGES = 5;
const BATCH_DELAY_MS = 3000;
const imageBatchBuffer = new Map();

const LINH_VUC = [
  "Môi trường, Hạ tầng, Xây dựng",
  "Văn hoá, Giáo dục, Y tế",
  "Dịch vụ công, Thủ tục hành chính",
  "An ninh trật tự, PCCC",
];

const send = (id, text) => sendText(id, text).catch((e) => logger.error(`[Feedback] send ${id}: ${e.message}`));

const isPhone = (t) => /^(0|\+84)[3-9]\d{8}$/.test(t.replace(/\s/g, ""));
const isEmail = (t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.trim());
const isUrl = (t) => /^https?:\/\/.+/i.test(t.trim());

function isFeedbackTrigger(text) {
  const lower = (text || "").toLowerCase();
  return lower.includes("góp ý") || lower.includes("gop y") || lower.includes("phản ánh") || lower.includes("phan anh") || lower === "goopy" || lower.includes("#goopy");
}

async function _displayName(userId, fallback = "") {
  if (fallback) return fallback;
  const f = await ZaloFollowerRepo.findByUserId(userId).catch(() => null);
  return f?.displayName || "";
}

async function startFeedback(userId, displayName = "") {
  const name = await _displayName(userId, displayName);
  setState(userId, { step: "waiting_contact", displayName: name });
  await send(userId,
    "💬 Chào mừng bạn đến với Góp ý - Phản ánh của UBND Xã Hòa Tiến!\n\n" +
    "📞 Vui lòng nhập SĐT (09xxxxxxxx) hoặc email để chúng tôi liên hệ lại:\n\n" +
    '(Nhắn "huỷ" để thoát bất cứ lúc nào)'
  );
}

// Danh sách lĩnh vực: ưu tiên Category trong DB, fallback list cố định
async function _categories() {
  const cats = await Category.find({}).sort({ order: 1 }).lean().catch(() => []);
  if (cats.length) return cats.map((c) => ({ name: c.name, categoryId: String(c._id), groupId: c.zaloGroupId || "" }));
  return LINH_VUC.map((name) => ({ name, categoryId: null, groupId: "" }));
}

async function sendCategoryMenu(userId) {
  const list = await _categories();
  await send(userId, "🏷️ Chọn loại phản ánh:\n\n" + list.map((c, i) => `${i + 1}️⃣ ${c.name}`).join("\n") + `\n\n(Gõ số 1-${list.length} để chọn)`);
}

async function sendImagePrompt(userId, count) {
  if (count === 0) {
    await send(userId,
      `📎 Bạn có muốn gửi hình ảnh minh hoạ không? (Tối đa ${MAX_IMAGES} ảnh)\n\n` +
      "• Gửi 1 hoặc nhiều ảnh từ điện thoại\n• Hoặc gửi URL ảnh\n\n1️⃣ Gõ số 1 để bỏ qua"
    );
  } else {
    await send(userId,
      `✅ Đã có ${count}/${MAX_IMAGES} ảnh\n\n` +
      `${count < MAX_IMAGES ? "• Gửi thêm ảnh\n" : ""}• Nhắn "xong" để tiếp tục`
    );
  }
}

async function sendConfirmation(userId, state) {
  const imgs = state.imageUrls || [];
  await send(userId,
    "📋 Xác nhận phản ánh:\n" +
    `• Liên hệ: ${state.contact}\n` +
    `• Loại: ${state.linhVuc || "Chưa chọn"}\n` +
    `• Nội dung: ${state.content}\n` +
    `• Hình ảnh: ${imgs.length > 0 ? `✅ ${imgs.length} ảnh` : "❌ Không có"}\n\n` +
    "Trả lời bằng số:\n1️⃣ Xác nhận gửi\n2️⃣ Nhập lại\n3️⃣ Huỷ"
  );
}

async function handleText(userId, text, displayName) {
  const state = getState(userId);
  const lower = text.toLowerCase().trim().normalize("NFC");

  if (["huỷ", "hủy", "huy", "cancel", "thoát", "thoat"].includes(lower)) {
    clearState(userId);
    await send(userId, '❌ Đã huỷ. Nhắn "phản ánh" để bắt đầu lại.');
    return;
  }

  if (!state) {
    if (isFeedbackTrigger(text)) await startFeedback(userId, displayName);
    return;
  }

  if (state.step === "waiting_contact") {
    if (!isPhone(text) && !isEmail(text)) {
      await send(userId, "⚠️ Thông tin liên hệ không hợp lệ.\nNhập SĐT (VD: 0912345678) hoặc email.\n\n(Nhắn \"huỷ\" để thoát)");
      return;
    }
    setState(userId, { step: "waiting_category", contact: text.trim(), displayName: displayName || state.displayName || "" });
    await sendCategoryMenu(userId);
    return;
  }

  if (state.step === "waiting_category") {
    const list = await _categories();
    const idx = parseInt(lower) - 1;
    if (isNaN(idx) || !list[idx]) {
      await send(userId, `⚠️ Vui lòng gõ số từ 1 đến ${list.length}.`);
      await sendCategoryMenu(userId);
      return;
    }
    const cat = list[idx];
    setState(userId, { ...state, step: "waiting_content", linhVuc: cat.name, categoryId: cat.categoryId, categoryGroupId: cat.groupId });
    await send(userId, `✅ Loại: ${cat.name}\n\n✏️ Nhập nội dung phản ánh (tối thiểu 5 ký tự):\n\n(Nhắn "huỷ" để thoát)`);
    return;
  }

  if (state.step === "waiting_content") {
    if (text.trim().length < 5) { await send(userId, "⚠️ Nội dung quá ngắn (tối thiểu 5 ký tự)."); return; }
    setState(userId, { ...state, step: "waiting_image", content: text.trim(), imageUrls: [] });
    await sendImagePrompt(userId, 0);
    return;
  }

  if (state.step === "waiting_image") {
    const imgs = state.imageUrls || [];
    const doneKw = ["1", "xong", "done", "không có", "khong co", "không", "khong", "bỏ qua", "bo qua"];
    if (doneKw.some((k) => lower === k)) {
      setState(userId, { ...state, step: "waiting_confirm" });
      await sendConfirmation(userId, state);
      return;
    }
    if (isUrl(text)) {
      if (imgs.length >= MAX_IMAGES) {
        setState(userId, { ...state, step: "waiting_confirm" });
        await sendConfirmation(userId, state);
        return;
      }
      await send(userId, "⏳ Đang tải ảnh lên...");
      try {
        const url = await uploadFromUrl(text.trim());
        const newImgs = [...imgs, url];
        setState(userId, { ...state, imageUrls: newImgs });
        if (newImgs.length >= MAX_IMAGES) {
          setState(userId, { ...state, imageUrls: newImgs, step: "waiting_confirm" });
          await sendConfirmation(userId, { ...state, imageUrls: newImgs });
        } else await sendImagePrompt(userId, newImgs.length);
      } catch {
        await send(userId, '⚠️ Không tải được ảnh từ URL. Thử URL khác hoặc nhắn "xong".');
      }
      return;
    }
    await sendImagePrompt(userId, imgs.length);
    return;
  }

  if (state.step === "waiting_confirm") {
    if (lower === "1" || ["xác nhận", "xac nhan", "gửi", "gui", "ok", "đồng ý", "dong y"].some((k) => lower.includes(k))) {
      await saveFeedback(userId, state);
      return;
    }
    if (lower === "2" || ["nhập lại", "nhap lai", "làm lại", "lam lai"].some((k) => lower.includes(k))) {
      await startFeedback(userId, state.displayName);
      return;
    }
    if (lower === "3") {
      clearState(userId);
      await send(userId, "❌ Đã huỷ.");
      return;
    }
    await send(userId, "⚠️ Trả lời bằng số:\n1️⃣ Xác nhận gửi\n2️⃣ Nhập lại\n3️⃣ Huỷ");
    return;
  }
}

async function handleImage(userId, imageUrl) {
  const state = getState(userId);
  if (!state || state.step !== "waiting_image") return;
  const existing = imageBatchBuffer.get(userId) || { urls: [], timer: null };
  existing.urls.push(imageUrl);
  if (existing.timer) clearTimeout(existing.timer);
  existing.timer = setTimeout(() => _processBatch(userId), BATCH_DELAY_MS);
  imageBatchBuffer.set(userId, existing);
}

async function _processBatch(userId) {
  const batch = imageBatchBuffer.get(userId);
  imageBatchBuffer.delete(userId);
  if (!batch || batch.urls.length === 0) return;
  const state = getState(userId);
  if (!state || state.step !== "waiting_image") return;

  const cur = state.imageUrls || [];
  const remaining = MAX_IMAGES - cur.length;
  if (remaining <= 0) {
    setState(userId, { ...state, step: "waiting_confirm" });
    await sendConfirmation(userId, state);
    return;
  }
  const toProcess = batch.urls.slice(0, remaining);
  await send(userId, `⏳ Đang tải ${toProcess.length} ảnh lên...`);
  const results = await Promise.allSettled(toProcess.map((u) => uploadFromZaloImageUrl(u)));
  const uploaded = results.filter((r) => r.status === "fulfilled").map((r) => r.value);

  const fresh = getState(userId);
  if (!fresh || fresh.step !== "waiting_image") return;
  const freshImgs = fresh.imageUrls || [];
  const newImgs = [...freshImgs, ...uploaded].slice(0, MAX_IMAGES);
  const msg = `✅ Đã thêm ${uploaded.length} ảnh (${newImgs.length}/${MAX_IMAGES})`;
  if (newImgs.length >= MAX_IMAGES) {
    setState(userId, { ...fresh, imageUrls: newImgs, step: "waiting_confirm" });
    await send(userId, msg + ". Đã đạt tối đa.");
    await sendConfirmation(userId, { ...fresh, imageUrls: newImgs });
  } else {
    setState(userId, { ...fresh, imageUrls: newImgs });
    await send(userId, msg + '\n\nGửi thêm ảnh hoặc nhắn "xong" để tiếp tục.');
  }
}

async function saveFeedback(userId, state) {
  try {
    const displayName = await _displayName(userId, state.displayName);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);
    const imageUrls = state.imageUrls || [];
    const fb = await Feedback.create({
      userId, displayName, contact: state.contact, content: state.content,
      imageUrl: imageUrls[0] || "", imageUrls, linhVuc: state.linhVuc || "",
      categoryId: state.categoryId || null, deadline,
    });

    try {
      const InAppAlertService = require("./InAppAlertService");
      InAppAlertService.notifyNewFeedback(fb).catch(() => {});
    } catch (alertErr) {
      logger.error(`[Feedback Alert] Lỗi khi tạo thông báo in-app: ${alertErr.message}`);
    }

    clearState(userId);
    const code = fb._id.toString().slice(-5).toUpperCase();
    await send(userId, `✅ Đã tiếp nhận phản ánh!\n\nMã phản ánh: #${code}\nUBND Xã Hòa Tiến sẽ xử lý và phản hồi. Cảm ơn bạn!`);
    logger.info(`[Feedback] mới #${code} userId=${userId} linhVuc=${state.linhVuc} imgs=${imageUrls.length}`);

    // Thông báo vào nhóm Zalo của lĩnh vực (nếu có)
    if (state.categoryGroupId) {
      const imgInfo = imageUrls.length ? `🖼️ ${imageUrls.length} ảnh` : "🖼️ Không ảnh";
      const groupMsg =
        `📩 PHẢN ÁNH MỚI #${code}\n${"─".repeat(26)}\n` +
        (displayName ? `👤 ${displayName}\n` : "") +
        `📞 ${state.contact}\n🏷️ ${state.linhVuc}\n📝 ${state.content}\n${imgInfo}`;
      sendText(state.categoryGroupId, groupMsg, true).catch(() => {});
    }
  } catch (err) {
    logger.error(`[Feedback] lưu thất bại: ${err.message}`);
    await send(userId, "⚠️ Có lỗi khi lưu phản ánh. Vui lòng thử lại sau.");
  }
}

module.exports = { startFeedback, handleText, handleImage, isFeedbackTrigger, getState };
