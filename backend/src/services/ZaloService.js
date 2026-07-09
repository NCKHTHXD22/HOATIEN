const axios = require("axios").default;
const ZaloSessionRepo = require("../repositories/mongo/ZaloSessionRepo");
const ZaloConfigRepo = require("../repositories/mongo/ZaloConfigRepo");
const ZaloFollowerRepo = require("../repositories/mongo/ZaloFollowerRepo");
const ZaloEvent = require("../models/mongo/ZaloEvent");
const SearchService = require("./SearchService");
const HouseholdRepo = require("../repositories/pg/HouseholdRepo");
const MemberRepo = require("../repositories/pg/MemberRepo");
const { formatZaloReply } = require("../utils/zaloFormat");
const logger = require("../utils/logger");

const feedbackChat = require("./feedbackChat");

const MENU_TEXT =
  "Xin chào! Vui lòng chọn cách tra cứu:\n" +
  "1. Tra cứu theo tên\n" +
  "2. Tra cứu theo CCCD\n" +
  "3. Tra cứu theo số điện thoại\n\n" +
  'Hoặc nhắn "phản ánh" để gửi góp ý / phản ánh.';

function stateMachine(session, text) {
  const t = text.trim();
  switch (session.state) {
    case "IDLE":
      return { nextState: "AWAIT_TYPE", reply: MENU_TEXT };

    case "AWAIT_TYPE":
      if (t === "1") return { nextState: "AWAIT_QUERY", queryType: "name", reply: "Nhập họ tên cần tra cứu:" };
      if (t === "2") return { nextState: "AWAIT_QUERY", queryType: "cccd", reply: "Nhập số CCCD:" };
      if (t === "3") return { nextState: "AWAIT_QUERY", queryType: "sdt", reply: "Nhập số điện thoại:" };
      return { nextState: "AWAIT_TYPE", reply: "Vui lòng nhập 1, 2 hoặc 3.\n" + MENU_TEXT };

    case "AWAIT_QUERY":
      return { nextState: "SHOWING_RESULT", query: { type: session.queryType, value: t }, reply: null };

    case "SHOWING_RESULT":
      if (t.toLowerCase() === "tìm lại" || t === "0") {
        return { nextState: "IDLE", reply: "Đã reset. Nhắn bất kỳ để bắt đầu tra cứu mới." };
      }
      return { nextState: "AWAIT_TYPE", reply: MENU_TEXT };

    default:
      return { nextState: "IDLE", reply: "Nhắn bất kỳ để bắt đầu." };
  }
}

async function handleMessage(zaloUserId, text) {
  // Luồng phản ánh: nếu đang trong luồng hoặc kích hoạt -> xử lý riêng (không đụng tra cứu hộ khẩu)
  if (feedbackChat.getState(zaloUserId) || feedbackChat.isFeedbackTrigger(text)) {
    await feedbackChat.handleText(zaloUserId, text);
    return null;
  }

  const session = (await ZaloSessionRepo.getOrCreate(zaloUserId)) || { state: "IDLE" };
  const { nextState, reply, query, queryType } = stateMachine(session, text);

  let replyText = reply;
  let results = [];

  if (query) {
    results = await _search(query);
    replyText = formatZaloReply(results);
    await ZaloSessionRepo.updateState(zaloUserId, {
      state: nextState, queryType: queryType || session.queryType,
      lastQuery: query.value, resultCount: results.length,
    });
    await _autoLink(zaloUserId, query);
  } else {
    await ZaloSessionRepo.updateState(zaloUserId, {
      state: nextState,
      ...(queryType && { queryType }),
    });
  }

  ZaloEvent.create({ type: "SEARCH", zaloUserId, query, resultCount: results.length }).catch(() => {});

  const token = await ZaloConfigRepo.getValidToken();
  if (token && replyText) {
    await _sendZaloMessage(zaloUserId, replyText, token);
  }

  return replyText;
}

async function _search({ type, value }) {
  if (type === "name") {
    const ids = await SearchService.searchByText(value);
    if (ids.length === 0) {
      return _pgLikeFallback(value);
    }
    return HouseholdRepo.findByIds(ids);
  }

  if (type === "cccd") {
    const member = await MemberRepo.findByCCCD(value);
    return member ? [member.household] : [];
  }

  if (type === "sdt") {
    const members = await MemberRepo.findBySdt(value);
    return members.map((m) => m.household).filter(Boolean);
  }

  return [];
}

async function _pgLikeFallback(name) {
  const { prisma } = require("../config/database");
  return prisma.household.findMany({
    where: { members: { some: { hoTen: { contains: name, mode: "insensitive" } } } },
    include: { members: true, village: true },
    take: 20,
  });
}

// Tự động liên kết follower Zalo ↔ nhân khẩu khi dân tra cứu chính họ (CCCD/SĐT khớp DUY NHẤT).
async function _autoLink(zaloUserId, query) {
  try {
    let member = null;
    if (query.type === "cccd") {
      member = await MemberRepo.findByCCCD(query.value);
    } else if (query.type === "sdt") {
      const members = await MemberRepo.findBySdt(query.value);
      if (members.length === 1) member = members[0]; // chỉ link khi SĐT khớp đúng 1 người
    }
    if (!member) return;
    // KHÔNG ghi đè nếu nhân khẩu đã gán cho userId khác
    if (member.zaloUserId && member.zaloUserId !== zaloUserId) return;
    if (member.zaloUserId !== zaloUserId) {
      await MemberRepo.update(member.id, { zaloUserId });
    }
    await ZaloFollowerRepo.setLink(zaloUserId, member.id);
    logger.info(`Auto-link Zalo ${zaloUserId} -> member ${member.id} (${member.hoTen}) via ${query.type}`);
  } catch (e) {
    logger.warn(`Auto-link failed [${zaloUserId}]: ${e.message}`);
  }
}

// Chuẩn hóa SĐT VN về dạng 0xxxxxxxxx (bỏ khoảng trắng/chấm, +84/84 -> 0)
function _normPhone(raw) {
  let s = String(raw || "").replace(/[\s.\-()]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length >= 10) s = "0" + s.slice(2);
  return /^0\d{9,10}$/.test(s) ? s : "";
}

// Webhook user_submit_info: dân bấm chia sẻ thông tin -> lưu SĐT + tự liên kết nhân khẩu
async function handleUserSubmitInfo(zaloUserId, info = {}) {
  const phone = _normPhone(info.phone);
  if (!phone) { logger.warn(`user_submit_info [${zaloUserId}]: SĐT không hợp lệ "${info.phone}"`); return; }
  await ZaloFollowerRepo.setPhone(zaloUserId, phone);

  // Khớp nhân khẩu theo SĐT (thử cả các biến thể +84/84)
  const variants = [phone, "+84" + phone.slice(1), "84" + phone.slice(1)];
  const { prisma } = require("../config/database");
  const candidates = await prisma.member.findMany({ where: { sdt: { in: variants } }, select: { id: true, hoTen: true, zaloUserId: true } });

  const token = await ZaloConfigRepo.getValidToken();
  const say = (text) => token && _sendZaloMessage(zaloUserId, text, token);

  if (candidates.length === 1) {
    const m = candidates[0];
    if (m.zaloUserId && m.zaloUserId !== zaloUserId) {
      logger.warn(`user_submit_info [${zaloUserId}]: SĐT ${phone} thuộc nhân khẩu đã liên kết Zalo khác`);
      await say("⚠️ Số điện thoại này đã được liên kết với một tài khoản Zalo khác. Vui lòng liên hệ UBND xã để được hỗ trợ.");
      return;
    }
    if (m.zaloUserId !== zaloUserId) await MemberRepo.update(m.id, { zaloUserId: zaloUserId });
    await ZaloFollowerRepo.setLink(zaloUserId, m.id);
    logger.info(`Auto-link Zalo ${zaloUserId} -> member ${m.id} (${m.hoTen}) via user_submit_info`);
    await say(`✅ Cảm ơn bạn! Đã liên kết tài khoản Zalo với hồ sơ nhân khẩu: ${m.hoTen}.`);
  } else if (candidates.length === 0) {
    logger.info(`user_submit_info [${zaloUserId}]: SĐT ${phone} chưa khớp nhân khẩu nào (đã lưu, chờ admin xử lý)`);
    await say("✅ Cảm ơn bạn đã chia sẻ! Chúng tôi đã ghi nhận số điện thoại và sẽ liên kết hồ sơ trong thời gian sớm nhất.");
  } else {
    logger.info(`user_submit_info [${zaloUserId}]: SĐT ${phone} khớp ${candidates.length} nhân khẩu — cần admin chọn tay`);
    await say("✅ Cảm ơn bạn đã chia sẻ! Cán bộ xã sẽ xác nhận và liên kết hồ sơ của bạn sớm.");
  }
}

async function _sendZaloMessage(toUserId, text, token) {
  try {
    await axios.post(
      "https://openapi.zalo.me/v2.0/oa/message",
      { recipient: { user_id: toUserId }, message: { text } },
      { headers: { access_token: token } }
    );
  } catch (err) {
    logger.error(`Zalo send failed [${toUserId}]: ${err.message}`);
  }
}

// URL tuyệt đối cho file trong /uploads (Zalo tải qua URL public của backend)
function _absUrl(url) {
  if (!url) return url;
  return url.startsWith("/") ? "https://api.dxvtech.vn" + encodeURI(url) : url;
}

// Upload 1 file tài liệu lên Zalo OA -> trả token (mirror QUESON).
// Tải file từ URL public của backend về buffer rồi upload multipart (dễ retry khi -216).
async function _uploadFileToZalo(fileUrl, originalName) {
  const FormData = require("form-data");
  const resp = await axios.get(fileUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(resp.data);
  const doUpload = (token) => {
    const form = new FormData();
    form.append("file", buffer, { filename: originalName || "file" });
    return axios.post("https://openapi.zalo.me/v2.0/oa/upload/file", form, {
      headers: { ...form.getHeaders(), access_token: token },
    });
  };
  let res = await doUpload(await ZaloConfigRepo.getValidToken());
  if (res.data?.error === -216) {
    const nt = await ZaloConfigRepo.refreshAccessToken();
    if (nt) res = await doUpload(nt);
  }
  if (res.data?.error !== 0) {
    throw new Error(`Zalo upload file error ${res.data?.error}: ${res.data?.message}`);
  }
  return res.data.data.token;
}

async function sendMessage(zaloUserId, text, attachments = []) {
  const token = await ZaloConfigRepo.getValidToken();
  if (!token) throw new Error("Zalo OA chưa được cấu hình access token");
  
  // Lọc ra các file ảnh (có loai là IMAGE hoặc đuôi là ảnh)
  const images = (attachments || []).filter(a => 
    a.loai === "IMAGE" || (a.tenFile && a.tenFile.match(/\.(jpg|jpeg|png|gif)$/i))
  );

  let payload = { recipient: { user_id: zaloUserId }, message: { text } };

  // Zalo OA hỗ trợ gửi kèm 1 ảnh qua media template
  if (images.length > 0 && images[0].url) {
    // Nếu url là dạng relative (/uploads/...), phải thêm domain vào
    const env = require("../config/env");
    let imgUrl = images[0].url;
    if (imgUrl.startsWith("/")) {
      const baseUrl = (env.CORS_ORIGINS && env.CORS_ORIGINS.length > 0 && env.CORS_ORIGINS[0].includes("dxvtech.vn"))
        ? "https://api.dxvtech.vn" 
        : "https://api.dxvtech.vn"; // Cố định domain api
        
      // encodeURI để tránh lỗi khoảng trắng trong tên file
      imgUrl = baseUrl + encodeURI(imgUrl);
    }

    payload.message = {
      text,
      attachment: {
        type: "template",
        payload: {
          template_type: "media",
          elements: [{
            media_type: "image",
            url: imgUrl
          }]
        }
      }
    };
  }

  const res = await axios.post(
    "https://openapi.zalo.me/v2.0/oa/message",
    payload,
    { headers: { access_token: token } }
  );
  if (res.data?.error && res.data.error !== 0) {
    throw new Error(`Zalo error ${res.data.error}: ${res.data.message || "Gửi thất bại"}`);
  }

  // Gửi file tài liệu (pdf/docx/xlsx...) — mỗi file 1 message riêng (Zalo không gộp với text)
  const docs = (attachments || []).filter(
    (a) => a.url && a.loai !== "IMAGE" && !(a.tenFile && a.tenFile.match(/\.(jpg|jpeg|png|gif)$/i))
  );
  for (const f of docs) {
    const fileToken = await _uploadFileToZalo(_absUrl(f.url), f.tenFile);
    const t2 = await ZaloConfigRepo.getValidToken();
    const fr = await axios.post(
      "https://openapi.zalo.me/v2.0/oa/message",
      { recipient: { user_id: zaloUserId }, message: { attachment: { type: "file", payload: { token: fileToken } } } },
      { headers: { access_token: t2 } }
    );
    if (fr.data?.error && fr.data.error !== 0) {
      throw new Error(`Zalo file error ${fr.data.error}: ${fr.data.message || "Gửi file thất bại"}`);
    }
  }

  return res.data;
}

// ─── Đồng bộ follower OA (mirror cách QUESON gọi Zalo API) ──────────────
// GET có tự refresh token 1 lần khi gặp lỗi -216 (token hết hạn)
async function _zaloGet(url) {
  let token = await ZaloConfigRepo.getValidToken();
  if (!token) throw new Error("Zalo OA chưa được cấu hình access token");
  let res = await axios.get(url, { headers: { access_token: token } });
  if (res.data?.error === -216) {
    token = await ZaloConfigRepo.refreshAccessToken();
    if (token) res = await axios.get(url, { headers: { access_token: token } });
  }
  return res.data;
}

async function _fetchAllFollowerIds() {
  const ids = [];
  let offset = 0;
  const count = 50;
  while (true) {
    const data = encodeURIComponent(JSON.stringify({ offset, count }));
    const result = await _zaloGet(`https://openapi.zalo.me/v2.0/oa/getfollowers?data=${data}`);
    if (result?.error !== 0) {
      logger.error(`Zalo getfollowers error ${result?.error}: ${result?.message}`);
      break;
    }
    const followers = result?.data?.followers || [];
    for (const f of followers) ids.push(f.user_id);
    if (followers.length < count) break;
    offset += count;
    await new Promise((r) => setTimeout(r, 300));
  }
  return ids;
}

async function _getFollowerProfile(userId) {
  // user_id phải là SỐ không ngoặc kép, nếu không Zalo trả -201 "user_id is not valid"
  const data = encodeURIComponent(`{"user_id":${userId}}`);
  const result = await _zaloGet(`https://openapi.zalo.me/v2.0/oa/getprofile?data=${data}`);
  if (result?.error !== 0) return { user_id: userId, display_name: "", avatar: "" };
  return {
    user_id: userId,
    display_name: result?.data?.display_name || "",
    avatar: result?.data?.avatar || "",
  };
}

// Gọi khi Zalo webhook báo có người mới follow OA — thêm ngay vào danh sách
// follower (Mongo) để admin thấy không cần đợi đồng bộ thủ công.
async function handleFollow(userId) {
  const profile = await _getFollowerProfile(userId);
  await ZaloFollowerRepo.upsertMany([profile]);
}

let _syncing = false;

async function _runSyncFollowers() {
  const ids = await _fetchAllFollowerIds();
  // Lưu user_id ngay để follower xuất hiện liền (tên rỗng), không ghi đè tên cũ
  await ZaloFollowerRepo.upsertIds(ids);
  // Điền tên/avatar dần (chậm vì Zalo giới hạn tốc độ getprofile)
  for (const userId of ids) {
    const p = await _getFollowerProfile(userId).catch(() => null);
    if (p && p.display_name) await ZaloFollowerRepo.upsertMany([p]);
    await new Promise((r) => setTimeout(r, 250));
  }
  logger.info(`Zalo followers synced: ${ids.length}`);
  return ids.length;
}

// Chạy NỀN: trả về ngay để tránh nginx 504 khi OA có nhiều follower
function startSyncFollowers() {
  if (_syncing) return { running: true };
  _syncing = true;
  _runSyncFollowers()
    .catch((e) => logger.error(`syncFollowers: ${e.message}`))
    .finally(() => { _syncing = false; });
  return { started: true };
}

const isSyncing = () => _syncing;

// Gửi 1 tin tới nhiều follower (theo user_id). Trả về kết quả từng người.
async function sendToFollowers(userIds, text, attachments = []) {
  const results = [];
  for (const userId of userIds) {
    try {
      await sendMessage(userId, text, attachments);
      results.push({ userId, sent: true });
    } catch (e) {
      results.push({ userId, sent: false, error: e.message });
    }
    await new Promise((r) => setTimeout(r, 200)); // tránh rate limit
  }
  return results;
}

module.exports = { handleMessage, handleFollow, handleUserSubmitInfo, sendMessage, startSyncFollowers, isSyncing, sendToFollowers };
