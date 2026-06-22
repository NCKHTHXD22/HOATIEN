// Upload ảnh lên Cloudinary cho luồng phản ánh (dùng client config sẵn có)
const cloudinary = require("../config/cloudinary");
const axios = require("axios").default;

const FOLDER = "hoatien-phananh";

async function uploadFromUrl(url) {
  const r = await cloudinary.uploader.upload(url, { folder: FOLDER, resource_type: "image" });
  return r.secure_url;
}

function uploadFromBuffer(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, resource_type: "image", public_id: filename },
      (err, res) => (err ? reject(err) : resolve(res.secure_url))
    );
    stream.end(buffer);
  });
}

function uploadVideoFromBuffer(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, resource_type: "video", public_id: filename },
      (err, res) => (err ? reject(err) : resolve(res.secure_url))
    );
    stream.end(buffer);
  });
}

function uploadRawFromBuffer(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, resource_type: "raw", public_id: filename },
      (err, res) => (err ? reject(err) : resolve(res.secure_url))
    );
    stream.end(buffer);
  });
}

async function uploadFromZaloImageUrl(zaloUrl) {
  const res = await axios.get(zaloUrl, { responseType: "arraybuffer", timeout: 15000 });
  return uploadFromBuffer(Buffer.from(res.data), `zalo-${Date.now()}`);
}

module.exports = { uploadFromUrl, uploadFromBuffer, uploadVideoFromBuffer, uploadRawFromBuffer, uploadFromZaloImageUrl };
