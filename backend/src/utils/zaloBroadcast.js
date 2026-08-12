// Zalo OA API cho module broadcast (port từ QUESON, dùng token của HOATIEN qua ZaloConfigRepo)
const axios = require("axios").default;
const fs = require("fs");
const path = require("path");
const ZaloConfigRepo = require("../repositories/mongo/ZaloConfigRepo");

const MSG_API = "https://openapi.zalo.me/v2.0/oa/message";

const recipient = (id, isGroup) => (isGroup ? { group_id: String(id) } : { user_id: String(id) });

// POST có tự refresh token 1 lần khi gặp -216
async function _post(url, data) {
  let token = await ZaloConfigRepo.getValidToken();
  if (!token) throw new Error("Zalo OA chưa cấu hình access token");
  const doReq = (t) => axios.post(url, data, { headers: { access_token: t, "Content-Type": "application/json" } });
  let res = await doReq(token);
  if (res.data?.error === -216) {
    token = await ZaloConfigRepo.refreshAccessToken();
    if (token) res = await doReq(token);
  }
  return res;
}

async function sendText(id, text, isGroup = false) {
  const res = await _post(MSG_API, { recipient: recipient(id, isGroup), message: { text } });
  if (res.data?.error !== 0) throw new Error(`Zalo ${res.data?.error}: ${res.data?.message}`);
}

// Gửi tin dạng THẺ danh sách (list template) — hiển thị bài viết như card đẹp
// elements: [{ title, subtitle, image_url, default_action:{ type:"oa.open.url", url } }]
async function sendArticleCard(id, elements, isGroup = false) {
  const res = await _post(MSG_API, {
    recipient: recipient(id, isGroup),
    message: { attachment: { type: "template", payload: { template_type: "list", elements } } },
  });
  if (res.data?.error !== 0) throw new Error(`Zalo card ${res.data?.error}: ${res.data?.message}`);
}

// Gửi nhiều ảnh (theo attachment_id đã upload), mỗi ảnh 1 message
async function sendImages(id, attachmentIds, isGroup = false) {
  for (const attId of attachmentIds) {
    const res = await _post(MSG_API, {
      recipient: recipient(id, isGroup),
      message: { attachment: { type: "template", payload: { template_type: "media", elements: [{ media_type: "image", attachment_id: attId }] } } },
    });
    if (res.data?.error !== 0) throw new Error(`Zalo ảnh ${res.data?.error}: ${res.data?.message}`);
  }
}

async function sendFile(id, fileToken, isGroup = false) {
  const res = await _post(MSG_API, { recipient: recipient(id, isGroup), message: { attachment: { type: "file", payload: { token: fileToken } } } });
  if (res.data?.error !== 0) throw new Error(`Zalo file ${res.data?.error}: ${res.data?.message}`);
}

async function _upload(url, buildForm) {
  let token = await ZaloConfigRepo.getValidToken();
  if (!token) throw new Error("Zalo OA chưa cấu hình access token");
  // Mỗi lần gọi tạo 1 form mới (cùng instance cho body + headers để khớp boundary)
  const doUpload = (t) => {
    const form = buildForm();
    return axios.post(url, form, { headers: { ...form.getHeaders(), access_token: t } });
  };
  let res = await doUpload(token);
  if (res.data?.error === -216) {
    token = await ZaloConfigRepo.refreshAccessToken();
    if (token) res = await doUpload(token);
  }
  return res;
}

// Upload ảnh từ file local -> trả attachment_id
async function uploadImageToZalo(filepath) {
  const FormData = require("form-data");
  const build = () => {
    const form = new FormData();
    form.append("file", fs.readFileSync(filepath), { filename: path.basename(filepath) });
    return form;
  };
  const res = await _upload("https://openapi.zalo.me/v2.0/oa/upload/image", build);
  if (res.data?.error !== 0) throw new Error(`Upload ảnh: ${res.data?.message}`);
  const id = res.data?.data?.attachment_id;
  if (!id) throw new Error("Không lấy được attachment_id từ Zalo");
  return id;
}

// Upload file tài liệu -> trả file token
async function uploadFileToZalo(filepath, originalName) {
  const FormData = require("form-data");
  const build = () => {
    const form = new FormData();
    form.append("file", fs.readFileSync(filepath), { filename: originalName });
    return form;
  };
  const res = await _upload("https://openapi.zalo.me/v2.0/oa/upload/file", build);
  if (res.data?.error !== 0) throw new Error(`Upload file: ${res.data?.message}`);
  const token = res.data?.data?.token;
  if (!token) throw new Error("Không lấy được file token từ Zalo");
  return token;
}

// GET có tự refresh token 1 lần khi gặp -216
async function _get(url) {
  let token = await ZaloConfigRepo.getValidToken();
  if (!token) throw new Error("Zalo OA chưa cấu hình access token");
  const doReq = (t) => axios.get(url, { headers: { access_token: t } });
  let res = await doReq(token);
  if (res.data?.error === -216) {
    token = await ZaloConfigRepo.refreshAccessToken();
    if (token) res = await doReq(token);
  }
  return res;
}

// Liệt kê bài viết/broadcast thật trên OA Manager (type: "normal" | "video")
async function getArticleSlice(type = "normal", offset = 0, limit = 20) {
  const url = `https://openapi.zalo.me/v2.0/article/getslice?type=${type}&offset=${offset}&limit=${limit}`;
  const res = await _get(url);
  if (res.data?.error !== 0) throw new Error(`Zalo article ${res.data?.error}: ${res.data?.message}`);
  return res.data?.data?.medias || [];
}

// Chi tiết 1 bài viết để đọc nội dung (title, cover, body text/ảnh...)
async function getArticleDetail(id) {
  const res = await _get(`https://openapi.zalo.me/v2.0/article/getdetail?id=${encodeURIComponent(id)}`);
  if (res.data?.error !== 0) throw new Error(`Zalo article detail ${res.data?.error}: ${res.data?.message}`);
  return res.data?.data;
}

// Tạo bài viết/broadcast lên OA. cover.photo_url & body image url NHẬN URL công khai (Zalo tự host lại).
async function createArticle(payload) {
  const res = await _post("https://openapi.zalo.me/v2.0/article/create", payload);
  if (res.data?.error !== 0) throw new Error(`Zalo article create ${res.data?.error}: ${res.data?.message}`);
  return res.data?.data; // { token }
}

// Xóa bài viết khỏi OA theo id (id lấy từ getslice)
async function removeArticle(id) {
  const res = await _post("https://openapi.zalo.me/v2.0/article/remove", { id });
  if (res.data?.error !== 0) throw new Error(`Zalo article remove ${res.data?.error}: ${res.data?.message}`);
  return true;
}

module.exports = { sendText, sendImages, sendFile, sendArticleCard, uploadImageToZalo, uploadFileToZalo, getArticleSlice, getArticleDetail, createArticle, removeArticle };
