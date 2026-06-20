const axios = require("axios").default;
const ZaloSessionRepo = require("../repositories/mongo/ZaloSessionRepo");
const ZaloConfigRepo = require("../repositories/mongo/ZaloConfigRepo");
const ZaloEvent = require("../models/mongo/ZaloEvent");
const SearchService = require("./SearchService");
const HouseholdRepo = require("../repositories/pg/HouseholdRepo");
const MemberRepo = require("../repositories/pg/MemberRepo");
const { formatZaloReply } = require("../utils/zaloFormat");
const logger = require("../utils/logger");

const MENU_TEXT =
  "Xin chào! Vui lòng chọn cách tra cứu:\n" +
  "1. Tra cứu theo tên\n" +
  "2. Tra cứu theo CCCD\n" +
  "3. Tra cứu theo số điện thoại";

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

async function _sendZaloMessage(toUserId, text, token) {
  try {
    await axios.post(
      "https://openapi.zalo.me/v3.0/oa/message/cs",
      { recipient: { user_id: toUserId }, message: { text } },
      { headers: { access_token: token } }
    );
  } catch (err) {
    logger.error(`Zalo send failed [${toUserId}]: ${err.message}`);
  }
}

async function sendMessage(zaloUserId, text) {
  const token = await ZaloConfigRepo.getValidToken();
  if (!token) throw new Error("Zalo OA chưa được cấu hình access token");
  // Khác _sendZaloMessage (best-effort cho luồng tra cứu): ở đây phải NÉM lỗi
  // để NotificationService đánh dấu FAILED chính xác.
  const res = await axios.post(
    "https://openapi.zalo.me/v3.0/oa/message/cs",
    { recipient: { user_id: zaloUserId }, message: { text } },
    { headers: { access_token: token } }
  );
  if (res.data?.error && res.data.error !== 0) {
    throw new Error(`Zalo error ${res.data.error}: ${res.data.message || "Gửi thất bại"}`);
  }
  return res.data;
}

module.exports = { handleMessage, sendMessage };
