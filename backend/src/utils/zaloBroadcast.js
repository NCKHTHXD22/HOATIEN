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

module.exports = { sendText, sendImages, sendFile, uploadImageToZalo, uploadFileToZalo };
