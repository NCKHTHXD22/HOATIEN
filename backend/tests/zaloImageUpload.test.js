const { test, before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { createRequire } = require("node:module");
const vm = require("node:vm");
const express = require("express");
const request = require("supertest");
const axios = require("axios").default;
const sharp = require("sharp");

// Isolate uploads from credentials, databases, and the live Zalo API.
const repoPath = require.resolve("../src/repositories/mongo/ZaloConfigRepo");
const tokens = {
  getValidToken: async () => "test-token",
  refreshAccessToken: async () => "refreshed-token",
};
require.cache[repoPath] = { id: repoPath, filename: repoPath, loaded: true, exports: tokens };
const { uploadImageToZalo } = require("../src/utils/zaloBroadcast");

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
let directory;
let smallImage;
let largeImage;
let app;

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "hoatien-image-test-"));
  smallImage = await sharp({ create: { width: 80, height: 40, channels: 3, background: "white" } }).jpeg().toBuffer();
  largeImage = await sharp(randomBytes(1800 * 1200 * 3), {
    raw: { width: 1800, height: 1200, channels: 3 },
  }).png().toBuffer();
  assert.ok(largeImage.length > 1024 * 1024);

  // Exercise the actual multipart route while isolating unrelated application services.
  await fs.mkdir(path.join(directory, "uploads"));
  const routePath = require.resolve("../src/routes/broadcast");
  const routeRequire = createRequire(routePath);
  const routeModule = { exports: {} };
  const pass = (_req, _res, next) => next();
  vm.runInNewContext(await fs.readFile(routePath, "utf8"), {
    module: routeModule,
    __dirname: path.join(directory, "src", "routes"),
    require(id) {
      if (id === "../middlewares/auth.middleware") return { authenticate: pass, requireRole: () => pass, requireSendPermission: () => pass };
      if (id === "../utils/zaloBroadcast") return { uploadImageToZalo };
      if (id.startsWith("../")) return {};
      return routeRequire(id);
    },
  }, { filename: routePath });
  app = express().use("/api/broadcast", routeModule.exports);
});

afterEach(() => mock.restoreAll());
after(async () => {
  const uploads = path.join(directory, "uploads");
  for (const filename of await fs.readdir(uploads)) await fs.unlink(path.join(uploads, filename));
  await fs.rmdir(uploads);
  for (const filename of await fs.readdir(directory)) await fs.unlink(path.join(directory, filename));
  await fs.rmdir(directory);
  delete require.cache[repoPath];
});

async function fixture(filename, buffer) {
  const filepath = path.join(directory, filename);
  await fs.writeFile(filepath, buffer);
  return filepath;
}

function captureUpload(responses = [{ error: 0, data: { attachment_id: "test-attachment" } }]) {
  const uploads = [];
  mock.method(axios, "post", async (url, form, options) => {
    assert.equal(url, "https://openapi.zalo.me/v2.0/oa/upload/image");
    const multipart = form.getBuffer();
    const start = multipart.indexOf("\r\n\r\n") + 4;
    const end = multipart.lastIndexOf(Buffer.from(`\r\n--${form.getBoundary()}`));
    uploads.push({ image: multipart.subarray(start, end), headers: multipart.subarray(0, start).toString(), options });
    return { data: responses[Math.min(uploads.length - 1, responses.length - 1)] };
  });
  return uploads;
}

test("keeps an existing small JPEG unchanged", async () => {
  const filepath = await fixture("small.jpg", smallImage);
  const uploads = captureUpload();
  assert.equal(await uploadImageToZalo(filepath), "test-attachment");
  assert.deepEqual(uploads[0].image, smallImage);
  assert.match(uploads[0].headers, /filename="small.jpg"/);
});

test("compresses an image over 1MB for Zalo without changing the source file or cropping", async () => {
  const filepath = await fixture("large.png", largeImage);
  const uploads = captureUpload();
  await uploadImageToZalo(filepath);
  assert.ok(uploads[0].image.length <= 1000000);
  const metadata = await sharp(uploads[0].image).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.ok(Math.abs(metadata.width / metadata.height - 1.5) < 0.01);
  assert.match(uploads[0].headers, /filename="large.jpg"/);
  assert.match(uploads[0].headers, /Content-Type: image\/jpeg/);
  assert.deepEqual(await fs.readFile(filepath), largeImage);
});

test("accepts a source image exactly 10MB", async () => {
  const image = Buffer.concat([smallImage, Buffer.alloc(MAX_UPLOAD_BYTES - smallImage.length)]);
  const filepath = await fixture("exact-limit.jpg", image);
  const uploads = captureUpload();
  assert.equal(await uploadImageToZalo(filepath), "test-attachment");
  assert.ok(uploads[0].image.length <= 1000000);
});

test("rejects images above 10MB before calling Zalo", async () => {
  const filepath = await fixture("too-large.jpg", Buffer.alloc(MAX_UPLOAD_BYTES + 1));
  const uploads = captureUpload();
  await assert.rejects(uploadImageToZalo(filepath), /10MB/);
  assert.equal(uploads.length, 0);
});

test("reuses the compressed image when refreshing an expired token", async () => {
  const filepath = await fixture("retry.png", largeImage);
  const uploads = captureUpload([
    { error: -216 },
    { error: 0, data: { attachment_id: "retry-attachment" } },
  ]);
  assert.equal(await uploadImageToZalo(filepath), "retry-attachment");
  assert.equal(uploads.length, 2);
  assert.ok(uploads[0].image.length <= 1000000);
  assert.deepEqual(uploads[0].image, uploads[1].image);
  assert.equal(uploads[1].options.headers.access_token, "refreshed-token");
});

test("still reports an upload error returned by Zalo", async () => {
  const filepath = await fixture("error.jpg", smallImage);
  captureUpload([{ error: -1, message: "Upload rejected" }]);
  await assert.rejects(uploadImageToZalo(filepath), /Upload ảnh: Upload rejected/);
});

test("multipart endpoint accepts five images of exactly 10MB each", async () => {
  const uploads = captureUpload();
  const image = Buffer.concat([smallImage, Buffer.alloc(MAX_UPLOAD_BYTES - smallImage.length)]);
  let upload = request(app).post("/api/broadcast/upload/image");
  for (let i = 0; i < 5; i++) upload = upload.attach("images", image, `image-${i}.jpg`);
  const response = await upload.expect(200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.attachmentIds.length, 5);
  assert.equal(uploads.length, 5);
  assert.ok(uploads.every(item => item.image.length <= 1000000));
});

test("multipart endpoint rejects a file one byte above 10MB with a clear error", async () => {
  const uploads = captureUpload();
  const response = await request(app).post("/api/broadcast/upload/image")
    .attach("images", Buffer.alloc(MAX_UPLOAD_BYTES + 1), "too-large.jpg")
    .expect(400);
  assert.match(response.body.error, /10MB/);
  assert.equal(uploads.length, 0);
});

test("multipart endpoint keeps the existing five-image limit", async () => {
  const uploads = captureUpload();
  let upload = request(app).post("/api/broadcast/upload/image");
  for (let i = 0; i < 6; i++) upload = upload.attach("images", smallImage, `image-${i}.jpg`);
  await upload.expect(400);
  assert.equal(uploads.length, 0);
});
