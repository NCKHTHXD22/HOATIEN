# Hệ thống Quản lý Hộ khẩu — Xã Hòa Tiến

Hệ thống quản lý dân cư (hộ khẩu, nhân khẩu, biến động dân số) cho UBND Xã Hòa Tiến, tích hợp tra cứu và gửi thông báo qua **Zalo Official Account**.

Tài liệu chi tiết: [Mô tả & đặc tả dự án](Documents/MoTa_DacTa_DuAn.md) · [Các luồng xử lý](Documents/LuongXuLy_DuAn.md)

## Kiến trúc

```
Web/admin-dashboard/   Frontend — React + Vite + Tailwind (deploy: Vercel)
backend/               Backend  — Node.js + Express (deploy: Render)
  ├─ prisma/            Schema PostgreSQL (Neon)
  └─ src/
      ├─ models/mongo/   Schema MongoDB Atlas (audit log, search index, Zalo, report cache)
      ├─ repositories/   Truy cập dữ liệu (pg/ cho Postgres, mongo/ cho MongoDB)
      ├─ services/       Nghiệp vụ
      ├─ routes/         API REST
      └─ jobs/           Job nền (refresh token Zalo, gửi thông báo lên lịch, đồng bộ search index)
```

**Cơ sở dữ liệu lai (Hybrid):** PostgreSQL cho dữ liệu quan hệ (hộ dân, nhân khẩu, thôn, thông báo...); MongoDB cho dữ liệu vận hành (audit log, chỉ mục tìm kiếm, cấu hình/log Zalo, cache báo cáo); Redis (Upstash) cho token Zalo OA.

## Tính năng chính

- Quản lý hộ dân, nhân khẩu theo thôn — tìm kiếm, tách hộ, gộp hộ
- Ghi nhận biến động dân cư (chuyển đến/chuyển đi) theo hộ và toàn xã
- Quản lý thôn/địa bàn, thống kê dân số theo thôn
- Soạn & gửi thông báo đa kênh (Zalo/SMS/Email), quản lý nhóm người nhận, khảo sát nhanh
- Tra cứu hộ khẩu qua chatbot Zalo OA
- Báo cáo — thống kê, xuất Excel/PDF/CSV
- Lịch sử thay đổi (audit log) cho từng hộ dân
- Phân quyền theo vai trò: SUPER_ADMIN / ADMIN_VILLAGE / VIEWER

## Cài đặt & chạy local

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev   # nếu cần khởi tạo/migrate schema
npm run dev               # hoặc npm start
```

Cần file `.env` trong `backend/` với tối thiểu: `DATABASE_URL`, `MONGODB_URI`, `JWT_SECRET`. Các biến còn lại (Zalo OA, Cloudinary, Upstash Redis, SMTP, ESMS) tùy theo tính năng cần dùng — xem `backend/src/config/env.js`.

### Frontend

```bash
cd Web/admin-dashboard
npm install
npm run dev      # dev server (Vite)
npm run build    # build production
```

## Triển khai

- **Backend**: Render.com — cấu hình tại [render.yaml](render.yaml).
- **Frontend**: Vercel — proxy `/api/*` về backend qua [Web/admin-dashboard/vercel.json](Web/admin-dashboard/vercel.json).
