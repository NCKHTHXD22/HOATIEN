# BLUEPRINT KIẾN TRÚC — Khuôn mẫu Full-stack (Hybrid DB)

> Tài liệu này mô tả **toàn bộ kiến trúc** dự án "Quản lý hộ dân xã Hoà Tiến" để **tái sử dụng làm khuôn mẫu (template)** cho các dự án mới, deploy trên mô hình server đã thiết lập:
> **Vercel (Frontend) + VPS Bizfly (Backend) + Neon (PostgreSQL) + MongoDB Atlas + Upstash Redis + Cloudinary.**

---

## 1. TRIẾT LÝ KIẾN TRÚC

**Hybrid Database (Polyglot Persistence)** — dùng đúng DB cho đúng loại dữ liệu:

| 🐘 PostgreSQL (source of truth) | 🍃 MongoDB (linh hoạt / log / cache) |
|---|---|
| Dữ liệu nghiệp vụ cốt lõi, quan hệ | Audit log (JSON snapshot), event stream |
| Cần ACID, transaction, FK, UNIQUE | Full-text search index |
| Query/thống kê: JOIN, GROUP BY | Cache kết quả tổng hợp, session (TTL) |
| Schema ổn định | Schema thay đổi tự do |

**Nguyên tắc vàng:** Service **luôn ghi PostgreSQL trước** (trong transaction), sau đó ghi MongoDB (audit/search) kiểu **fire-and-forget** (`.catch(() => {})`). MongoDB lỗi/sập **KHÔNG** làm hỏng nghiệp vụ chính.

---

## 2. TECH STACK

**Backend** (Node ≥18, CommonJS):
- `express` — HTTP framework
- `@prisma/client` + `prisma` — ORM cho PostgreSQL
- `mongoose` — ODM cho MongoDB
- `jsonwebtoken` + `bcryptjs` — auth
- `express-validator` — validate input
- `helmet`, `cors`, `morgan` — bảo mật/log HTTP
- `winston` — logger
- `node-cron` — job định kỳ
- `multer` — upload file
- `nodemailer` (Email), `axios` (Zalo/eSMS), `cloudinary`, `@upstash/redis`
- `exceljs`, `pdfkit` — xuất báo cáo

**Frontend** (React 19 + Vite + Tailwind 4):
- `react`, `react-dom`, `react-router-dom`
- `axios`, `lucide-react` (icon), `recharts` (biểu đồ), `clsx`

---

## 3. CẤU TRÚC THƯ MỤC

```
project/
├── backend/
│   ├── server.js                 # entry: middleware, routes, start, cron, graceful shutdown
│   ├── prisma/
│   │   ├── schema.prisma         # models PostgreSQL
│   │   └── seed.js               # seed dữ liệu khởi tạo (admin, danh mục)
│   └── src/
│       ├── config/
│       │   ├── env.js            # đọc & export biến môi trường
│       │   ├── database.js       # khởi tạo Prisma + Mongoose connect
│       │   ├── redis.js          # Upstash Redis client
│       │   └── cloudinary.js     # Cloudinary client
│       ├── routes/               # 1 file/domain + index.js gộp
│       ├── services/             # business logic, điều phối 2 DB
│       ├── repositories/
│       │   ├── pg/               # truy cập PostgreSQL (Prisma)
│       │   └── mongo/            # truy cập MongoDB (Mongoose)
│       ├── models/mongo/         # Mongoose schemas
│       ├── middlewares/          # auth, validate, error
│       └── utils/                # response, logger, diff, ...
└── Web/admin-dashboard/          # Frontend React
    ├── vercel.json               # rewrite /api → backend + SPA fallback
    └── src/
        ├── App.jsx               # router + ProtectedRoute
        ├── context/AuthContext.jsx
        ├── layouts/ pages/ components/
        └── services/             # 1 file/domain gọi axios
```

---

## 4. BỐN TẦNG (4-TIER) + QUY ƯỚC

`Routes → Services → Repositories → Database`

- **Routes**: nhận request, validate, kiểm tra quyền, gọi service, trả response. KHÔNG chứa business logic.
- **Services**: business logic; điều phối nhiều repo / 2 DB / external API.
- **Repositories**: chỉ truy cập DB (thin wrapper quanh Prisma/Mongoose). `pg/` và `mongo/` tách riêng.
- **Database**: PostgreSQL + MongoDB, 2 kết nối độc lập (`Promise.allSettled` khi connect).

### 4.1. Response chuẩn (`utils/response.js`)
```js
const ok        = (res, data, message="Success", code=200) => res.status(code).json({ success:true, message, data });
const created   = (res, data, message="Created") => ok(res, data, message, 201);
const fail      = (res, message="Bad Request", code=400, errors=null) => res.status(code).json({ success:false, message, ...(errors && {errors}) });
const notFound  = (res, m="Not found")   => fail(res, m, 404);
const unauthorized = (res, m="Unauthorized") => fail(res, m, 401);
const forbidden = (res, m="Forbidden")   => fail(res, m, 403);
const paginated = (res, data, total, page, limit) => res.status(200).json({ success:true, data, pagination:{ total, page:+page, limit:+limit, totalPages:Math.ceil(total/limit) }});
```
→ Mọi response: `{ success, message, data }` hoặc `{ success, data, pagination }`.

### 4.2. Error middleware (`middlewares/error.middleware.js`)
Map lỗi Prisma → HTTP: `P2025`→404, `P2002`→409 (duplicate), `ValidationError`→422; `err.isOperational`→statusCode tùy biến; còn lại → 500. Đặt `notFoundHandler` + `errorHandler` ở CUỐI server.js.

### 4.3. Validate (`middlewares/validate.middleware.js`)
Dùng `express-validator` ở route, rồi middleware `validate` gom lỗi → `fail(res, "Dữ liệu không hợp lệ", 422, errors)`.
```js
router.post("/", requireRole("ADMIN"),
  [ body("ten").notEmpty(), body("email").optional().isEmail() ],
  validate,
  async (req,res,next) => { try { created(res, await Service.create(req.body, req.user.id)); } catch(e){ next(e); } }
);
```

### 4.4. Pattern Service điều phối 2 DB
```js
async function update(id, newData, performedBy) {
  const oldData = await Repo.findById(id);
  if (!oldData) throw new Error("Không tìm thấy");
  const updated = await Repo.update(id, newData);                 // 1. PG trước (đồng bộ)
  AuditService.log({ entityType, entityId:id, action:"UPDATE",   // 2. Mongo audit (fire-and-forget)
    oldData, newData:updated, diff: computeDiff(oldData, updated), performedBy });
  SearchService.syncIndex(id).catch(() => {});                   // 3. sync search (bất đồng bộ)
  return updated;
}
```
Transaction nhiều bảng: `await prisma.$transaction(async (tx) => { ... })`.

---

## 5. AUTH & PHÂN QUYỀN (RBAC)

- **JWT** ký bằng `JWT_SECRET`, payload `{ id, username, role, ...flags }`, hết hạn `JWT_EXPIRES_IN` (vd 7d).
- Mật khẩu hash `bcryptjs` (salt 10). KHÔNG bao giờ trả `passwordHash`.
- **Roles**: `SUPER_ADMIN`, `ADMIN_*`, `VIEWER` (tùy dự án).
- Middleware (`auth.middleware.js`):
  - `authenticate` — đọc `Authorization: Bearer`, verify token, gán `req.user`.
  - `requireRole(...roles)` — chặn theo vai trò.
  - Có thể thêm middleware quyền hạt mịn (vd `requireSendPermission` dựa trên flag trong token).
- Login: `AuthService.login()` → `{ token, user }`. Frontend lưu `token` ở `localStorage`.

---

## 6. CROSS-CUTTING (MongoDB)

- **Audit log** (`audit_logs`): mọi CREATE/UPDATE/DELETE ghi snapshot `oldData/newData/diff[]`. Lấy lịch sử qua `AuditService.getHistory(entityType, entityId)`.
- **Search index** (`search_index`): sync từ PG → full-text search; fallback `LIKE` trên PG nếu rỗng; có job re-sync ban đêm.
- **Cron jobs** (`node-cron`, start trong `server.js`): vd quét việc đến lịch mỗi phút, refresh token, re-sync.
- **Đa kênh gửi**: Email (`nodemailer`/Gmail SMTP), SMS (`eSMS.vn`), Zalo OA (`openapi.zalo.me`). Mỗi recipient × kênh tạo 1 bản ghi `send` để theo dõi trạng thái (PENDING/SENT/FAILED/READ/CONFIRMED).
- **Upload file**: `multer` → **Cloudinary** (vì VPS/Render filesystem có thể không bền). Token Zalo OA lưu **Upstash Redis** (TTL).

---

## 7. EXTERNAL SERVICES (mô hình server mới)

| Dịch vụ | Dùng cho | Biến môi trường |
|---|---|---|
| **Neon** | PostgreSQL (managed, có web console) | `DATABASE_URL` (?sslmode=require) |
| **MongoDB Atlas** | MongoDB (log/cache/search) | `MONGODB_URI`, `MONGODB_DB_NAME` |
| **Upstash Redis** | Token/session (REST) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Cloudinary** | Lưu ảnh/file | `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` |
| **Zalo OA** | Tin nhắn/tra cứu | `ZALO_APP_ID/APP_SECRET/OA_ACCESS_TOKEN/OA_REFRESH_TOKEN/WEBHOOK_SECRET/VERIFIER_CODE` |
| **Gmail SMTP** | Email | `SMTP_USER`, `SMTP_PASS` |
| **eSMS.vn** | SMS | `ESMS_API_KEY`, `ESMS_SECRET_KEY`, `ESMS_BRANDNAME` |

### `.env` mẫu
```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://...neon.tech/db?sslmode=require
MONGODB_URI=mongodb+srv://...mongodb.net/
MONGODB_DB_NAME=ten_db
JWT_SECRET=...
JWT_EXPIRES_IN=7d
CORS_ORIGINS=https://<project>.vercel.app
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
# + Zalo / SMTP / eSMS nếu dùng
```

---

## 8. MÔ HÌNH DEPLOY

```
Browser ──https──► Vercel (<project>.vercel.app)   ← Frontend, auto-deploy từ GitHub
                      │  rewrite /api/*  (server-side, http OK → KHÔNG mixed-content)
                      ▼
                 VPS Bizfly (IP)
                 Nginx :80  ──►  Express + PM2 :3000   ← Backend (KHÔNG mở 3000)
                      │
        Neon · MongoDB Atlas · Upstash · Cloudinary
```

### Frontend (Vercel)
- `api.js`: `baseURL: '/api'` (**relative** — để browser gọi same-origin Vercel).
- `vercel.json`:
```json
{ "rewrites": [
  { "source": "/api/:path*", "destination": "http://<VPS_IP>/api/:path*" },
  { "source": "/(.*)", "destination": "/index.html" }
] }
```
⚠️ **KHÔNG** đặt `VITE_API_URL=http://IP` rồi gọi thẳng — trang Vercel là HTTPS, browser sẽ chặn mixed-content. Phải đi qua rewrite (Vercel proxy server-side, http OK). Rule `/(.*)→/index.html` là SPA fallback (thiếu nó deep-link bị 404).

### Backend (VPS) — các bước
```bash
apt install -y nodejs nginx ufw   # Node 20 qua nodesource
npm install -g pm2
git clone https://github.com/<user>/<repo>.git . && cd backend
cp .env.example .env && nano .env
npm install                        # KHÔNG --omit=dev (cần prisma CLI)
npx prisma generate
npx prisma db push                 # dự án dùng db push, KHÔNG có migrations
pm2 start server.js --name <app> && pm2 save && pm2 startup
```
Nginx reverse-proxy mọi request → `localhost:3000`; `ufw` chỉ mở 22/80/443.

### Lưu ý quan trọng
- `prisma db push` (không dùng `migrate deploy` nếu chưa có thư mục `migrations/`).
- Thiếu env Upstash/Cloudinary → **backend crash lúc khởi động** (client tạo ở require-time).
- Zalo OAuth/webhook thường **bắt buộc HTTPS** → cần domain + `certbot` cho VPS.
- Deploy lại backend: `git pull && npm install && pm2 restart <app>`. (Trên server `package-lock.json` hay bị sửa cục bộ → `git checkout` nó trước khi pull.)

---

## 9. FRONTEND — QUY ƯỚC

- **Axios instance** (`services/api.js`): interceptor request gắn `Bearer token`; interceptor response gặp 401 → xóa token + về `/login`.
- **Service layer**: mỗi domain 1 file (`xxxService.js`) export các hàm gọi `api.get/post/...`.
- **Auth**: `AuthContext` giữ trạng thái đăng nhập; `<ProtectedRoute>` chặn route khi chưa login.
- **Page**: mỗi màn hình 1 file trong `pages/`; modal CRUD đặt trong page; UI dùng component chung trong `components/ui.jsx`.
- **Dữ liệu form**: chuẩn hóa trước khi gửi — ngày → ISO (`new Date(x).toISOString()`), field optional rỗng → `null` (tránh lỗi Prisma DateTime & unique trên chuỗi rỗng).

---

## 10. CHECKLIST DỰNG DỰ ÁN MỚI TỪ TEMPLATE

1. [ ] Copy cấu trúc `backend/` + `Web/admin-dashboard/`; đổi tên, `package.json`.
2. [ ] Thiết kế `schema.prisma` (models PG) + Mongoose models (log/search).
3. [ ] Tạo Neon project, Atlas cluster, Upstash DB, Cloudinary → điền `.env`.
4. [ ] `prisma db push` + viết `seed.js` (tạo SUPER_ADMIN).
5. [ ] Viết routes/services/repos theo pattern mục 4; bê nguyên `utils/response.js`, `middlewares/*`, `config/*`.
6. [ ] Frontend: `api.js` relative `/api`, `AuthContext`, `ProtectedRoute`, service/page theo domain.
7. [ ] Tạo repo GitHub → kết nối Vercel (FE) + clone lên VPS (BE) + Nginx + PM2.
8. [ ] `vercel.json`: rewrite `/api` → VPS + SPA fallback. `CORS_ORIGINS` = domain Vercel.
9. [ ] (Nếu dùng Zalo) cấu hình webhook/OAuth + domain HTTPS.
10. [ ] Test: login → CRUD → audit log → đa kênh gửi.

---

*Khuôn mẫu rút ra từ dự án Hoà Tiến — dùng cho các dự án quản lý/tiện ích tương tự.*
