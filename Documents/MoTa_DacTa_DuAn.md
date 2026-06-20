# Mô tả & Đặc tả dự án — Hệ thống Quản lý Hộ khẩu Xã Hòa Tiến

## 1. Tổng quan

Hệ thống quản lý dân cư (hộ khẩu, nhân khẩu, biến động dân số) cho UBND Xã Hòa Tiến, tích hợp kênh tra cứu và gửi thông báo qua **Zalo Official Account (OA)**. Mục tiêu: số hóa sổ hộ khẩu giấy, cho phép cán bộ xã quản lý hộ dân theo từng thôn, ghi nhận biến động (chuyển đến/đi, tách/gộp hộ), gửi thông báo/khảo sát đến người dân qua Zalo/SMS/Email, và xuất báo cáo thống kê.

Đối tượng sử dụng:
- **Cán bộ UBND xã / thôn** (vai trò `ADMIN_VILLAGE`): quản lý hộ dân thuộc thôn mình.
- **Quản trị hệ thống** (vai trò `SUPER_ADMIN`): toàn quyền, quản lý tài khoản, cấu hình Zalo OA.
- **Người xem** (vai trò `VIEWER`): chỉ xem báo cáo, không sửa dữ liệu.
- **Người dân**: tra cứu thông tin hộ khẩu và nhận thông báo qua Zalo OA (không cần đăng nhập trang quản trị).

## 2. Kiến trúc & công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend | Node.js + Express |
| ORM dữ liệu quan hệ | Prisma (PostgreSQL — Neon) |
| Dữ liệu phi quan hệ | Mongoose (MongoDB Atlas) |
| Cache token / session | Redis (Upstash) |
| Lưu trữ tệp/ảnh | Cloudinary |
| Gửi SMS | ESMS.vn |
| Gửi Email | Gmail SMTP |
| Frontend | React + Vite + TailwindCSS |
| Triển khai backend | Render.com |
| Triển khai frontend | Vercel (rewrite proxy `/api/*` → Render) |
| Kênh người dân | Zalo Official Account (webhook + OA Message API v3.0) |

**Lý do dùng kiến trúc lai (Hybrid DB):**
- **PostgreSQL**: dữ liệu có cấu trúc, quan hệ chặt (Village, Household, Member, MovementRecord, AdminUser, Notification, Survey...) — cần ràng buộc khóa ngoại, transaction (tách/gộp hộ).
- **MongoDB**: dữ liệu vận hành/log không cần ràng buộc quan hệ — `AuditLog` (lịch sử thay đổi), `SearchIndex` (chỉ mục tìm kiếm full-text), `ZaloConfig`/`ZaloSession`/`ZaloEvent` (trạng thái OA), `ReportCache` (cache báo cáo có TTL).

## 3. Mô hình dữ liệu chính (PostgreSQL / Prisma)

- **Village** (thôn): `ma`, `ten`, `truongThon`, `moTa` — 1 thôn có nhiều `Household`, nhiều `AdminUser` quản lý.
- **Household** (hộ dân): `soHoKhau`, `diaChi`, `lat/lng`, `trangThai` (ACTIVE/DA_TACH/DA_GIAI_THE), `loaiHo` (THUONG_TRU/TAM_TRU/TAM_VANG), thuộc 1 `Village`, có nhiều `Member`, `MovementRecord`.
- **Member** (nhân khẩu): `hoTen`, `ngaySinh`, `gioiTinh`, `cccd` (unique), `sdt`, `email`, `zaloUserId`, `quanHeChuHo`, `laChuHo`, `trangThai` (ACTIVE/DA_CHUYEN_DI/DA_MAN), thuộc 1 `Household`.
- **MovementRecord** (biến động): `loai` (MOVE_IN/MOVE_OUT), `ngay`, `nguonGoc`, `noiDen`, `ghiChu`, gắn với `Household` + người thực hiện (`AdminUser`).
- **HouseholdRelation**: ghi lại quan hệ tách (SPLIT) / gộp (MERGE) giữa các hộ — `sourceId`, `targetId`, `memberIds[]`.
- **AdminUser**: `username`, `passwordHash`, `hoTen`, `role` (SUPER_ADMIN/ADMIN_VILLAGE/VIEWER), `zaloUserId`, `canSendNotification`, quản lý nhiều `Village`.
- **Notification** + **NotificationRecipient/Attachment/Send/Feedback**: hệ thống soạn — gửi — theo dõi trạng thái thông báo đa kênh (Zalo/SMS/Email).
- **RecipientGroup** (+ `RecipientGroupMember`): nhóm người nhận thông báo, tạo thủ công (MANUAL) hoặc tự động theo tiêu chí (AUTO — lọc theo thôn/giới tính/tuổi/loại hộ).
- **Survey** + **SurveyQuestion/SurveyResponse**: khảo sát nhanh gắn với một thông báo.

## 4. Mô hình dữ liệu phụ trợ (MongoDB)

- **AuditLog**: `entityType` (household/member/village/admin), `entityId`, `action` (CREATE/UPDATE/DELETE/SPLIT/MERGE/MOVE_IN/MOVE_OUT), `oldData`, `newData`, `diff[]`, `performedBy`, `note` — lưu vết toàn bộ thay đổi dữ liệu để đối chiếu/kiểm toán.
- **SearchIndex**: chỉ mục tìm kiếm full-text cho hộ dân (số hộ khẩu, tên chủ hộ, tên thôn, tokens) — đồng bộ mỗi khi hộ dân được tạo/sửa.
- **ZaloConfig / ZaloSession / ZaloEvent**: token OA (access/refresh), trạng thái hội thoại tra cứu (state machine), log webhook nhận từ Zalo.
- **ReportCache**: cache kết quả tổng hợp báo cáo (`stats_by_village`, `total_summary`) với TTL 30–60 phút để giảm tải truy vấn Postgres; được làm mới (invalidate) ngay khi có thay đổi dữ liệu hộ/nhân khẩu/thôn/biến động.

## 5. Danh sách chức năng (Use Case) đã triển khai

| Mã | Chức năng | Trạng thái |
|---|---|---|
| UC01 | Đăng nhập, phân quyền (SUPER_ADMIN/ADMIN_VILLAGE/VIEWER) | ✅ Hoàn thiện |
| UC02 | Quản lý tài khoản cán bộ (Nhân sự) | ✅ Hoàn thiện |
| UC03 | Quản lý hộ dân (CRUD, lọc theo loại hộ, phân trang) | ✅ Hoàn thiện |
| UC04 | Quản lý nhân khẩu trong hộ (thêm/xóa thành viên) | ✅ Hoàn thiện |
| UC05 | Tách hộ | ✅ Hoàn thiện |
| UC06 | Gộp hộ | ✅ Hoàn thiện |
| UC07/08 | Ghi nhận biến động chuyển đến/chuyển đi (theo hộ + toàn xã) | ✅ Hoàn thiện |
| UC09 | Tìm kiếm hộ dân (theo tên/CCCD/SĐT, full-text) | ✅ Hoàn thiện |
| UC10 | Quản lý thôn/địa bàn | ✅ Hoàn thiện (chặn xóa thôn còn hộ dân) |
| UC11 | Báo cáo số hộ, nhân khẩu theo thôn | ✅ Hoàn thiện |
| UC12 | Xuất báo cáo Excel/PDF/CSV | ✅ Hoàn thiện |
| UC13 | Phân quyền người dùng theo vai trò | ✅ Hoàn thiện |
| UC14 | Tra cứu hộ khẩu qua Zalo OA (chatbot) | ✅ Hoàn thiện |
| UC15 | Lịch sử thay đổi (Audit log) theo hộ dân | ✅ Hoàn thiện |
| — | Soạn & gửi thông báo đa kênh (Zalo/SMS/Email) | ✅ Hoàn thiện |
| — | Quản lý nhóm người nhận (thủ công/tự động) | ✅ Hoàn thiện |
| — | Khảo sát nhanh gắn với thông báo | ✅ Hoàn thiện |
| — | Báo cáo hiệu quả gửi thông báo | ✅ Hoàn thiện |
| — | Tin tức / Thông báo công khai | ⚠️ Chỉ có UI, chưa nối backend |
| — | Quản lý văn bản hành chính | ⚠️ Chỉ có UI, chưa nối backend |
| — | Phản ánh kiến nghị của công dân | ⚠️ Chỉ có UI, chưa nối backend |
| — | Cài đặt hệ thống (thông tin đơn vị, bảo mật) | ⚠️ Một phần (đổi mật khẩu, quản lý user) — phần còn lại UI tĩnh |

## 6. Tích hợp Zalo Official Account

- **Chatbot tra cứu** (`POST /api/zalo/webhook`): người dân chat với OA → state machine (IDLE → chọn loại tra cứu → nhập giá trị → trả kết quả) → tra theo tên (full-text qua SearchIndex), CCCD, hoặc SĐT.
- **Gửi thông báo chủ động**: `NotificationService` gọi `ZaloService.sendMessage` để gửi tin đến `zaloUserId` của từng nhân khẩu đã liên kết Zalo.
- **OAuth cấp quyền OA**: `GET /api/zalo/auth-url` → admin cấp quyền trên Zalo → `GET /api/zalo/callback` đổi code lấy access/refresh token, lưu Redis + Mongo.
- **Tự động làm mới token**: job nền `zaloTokenRefreshJob` chạy định kỳ, refresh access token trước khi hết hạn.

## 7. Quy tắc nghiệp vụ quan trọng

- **Xóa thôn**: chỉ cho phép khi thôn không còn hộ dân nào; nếu còn, trả lỗi rõ ràng yêu cầu chuyển/xóa hộ dân trước (không cascade xóa dữ liệu dân cư).
- **Tách hộ**: chọn các thành viên chuyển sang hộ mới (số hộ khẩu tự sinh); hộ gốc tự đánh dấu "Đã tách" nếu không còn thành viên.
- **Gộp hộ**: chuyển toàn bộ thành viên ACTIVE của các hộ nguồn sang hộ nhận, đánh dấu hộ nguồn "Đã giải thể", tự ghi nhận biến động MOVE_IN cho hộ nhận.
- **Báo cáo/Dashboard**: luôn lấy số liệu mới nhất sau mỗi lần tạo/sửa/xóa (cache MongoDB được invalidate ngay khi có thay đổi, không phải chờ TTL).
- **Audit log**: mọi hành động tạo/sửa/xóa/tách/gộp/biến động đều ghi vào `AuditLog` kèm dữ liệu cũ/mới để đối chiếu sau này.
