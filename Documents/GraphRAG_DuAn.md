# GraphRAG — Đồ thị tri thức dự án TIENICHOAZALO_HOATIEN

> Tài liệu này mô tả dự án dưới dạng **đồ thị tri thức (knowledge graph)**: các thực thể (node) là file/module/model thực tế trong code, và các quan hệ (edge) là lời gọi/phụ thuộc thực tế giữa chúng — không suy diễn. Dữ liệu máy-đọc-được đi kèm tại [graphrag_graph.json](graphrag_graph.json) (định dạng `{ nodes[], edges[] }`), dùng để nạp vào công cụ GraphRAG/RAG hoặc dựng lại đồ thị bằng Neo4j, NetworkX, v.v.

## 1. Loại node (entity types)

| Loại | Ý nghĩa | Số lượng |
|---|---|---|
| `page` | Trang React (route trong App.jsx) | 15 |
| `component` | Component UI dùng lại | 4 |
| `fe-service` | Module gọi API ở frontend (`src/services/*.js`) | 9 |
| `context` | React Context | 1 |
| `route` | File route Express (`backend/src/routes/*.js`) | 8 |
| `be-service` | Service nghiệp vụ backend | 12 |
| `repo-pg` | Repository PostgreSQL (Prisma) | 8 |
| `repo-mongo` | Repository MongoDB (Mongoose) | 6 |
| `model-pg` | Model Prisma (bảng Postgres) | 16 |
| `model-mongo` | Schema Mongoose (collection Mongo) | 8 |
| `middleware` | Middleware Express | 3 |

## 2. Đồ thị theo từng domain nghiệp vụ

### 2.1 Auth & Phân quyền
```
page:Login ──uses──> fe-service:authService ──calls──> route:auth.routes
route:auth.routes ──protected_by──> middleware:auth.middleware (authenticate, requireRole)
route:auth.routes ──uses──> be-service:AuthService ──uses──> repo-pg:AdminUserRepo ──reads_writes──> model-pg:AdminUser
context:AuthContext ──wraps──> page:* (toàn bộ app, cấp req.user/JWT cho mọi page)
```
3 vai trò cố định trong `model-pg:AdminUser.role`: `SUPER_ADMIN`, `ADMIN_VILLAGE`, `VIEWER`. Cờ bổ sung `canSendNotification` (Boolean) tách biệt khỏi role — một ADMIN_VILLAGE có thể bị thu hồi quyền gửi mà không đổi role.

### 2.2 Hộ dân / Nhân khẩu / Biến động dân cư
```
page:HoSo, page:BienDong ──uses──> fe-service:householdService, fe-service:memberService, fe-service:movementService
  ──calls──> route:household.routes, route:member.routes, route:movement.routes
route:household.routes ──uses──> be-service:HouseholdService ──uses──> repo-pg:HouseholdRepo ──reads_writes──> model-pg:Household
route:member.routes    ──uses──> be-service:MemberService    ──uses──> repo-pg:MemberRepo    ──reads_writes──> model-pg:Member
route:movement.routes  ──uses──> be-service:MovementService  ──uses──> repo-pg:MovementRepo  ──reads_writes──> model-pg:MovementRecord
be-service:HouseholdService ──also_writes──> model-pg:HouseholdRelation   (khi tách/gộp hộ — UC05/UC06)
be-service:HouseholdService, MemberService, MovementService, VillageService
  ──side_effect──> repo-mongo:ReportCacheRepo.invalidateAll()   (xoá cache báo cáo sau mọi mutation)
  ──side_effect──> be-service:AuditService.log()                (ghi lịch sử thay đổi)
be-service:HouseholdService ──side_effect──> be-service:SearchService.syncIndex() ──> repo-mongo:SearchIndexRepo
```
`model-pg:Household.to` (Tổ) — cột mới thêm 2026-06-21, tự do nhập text dạng "Tổ N", có index lọc qua `HouseholdRepo.findAll({ to })` và liệt kê qua `HouseholdRepo.findDistinctTo(villageId)`. Trang `HoSo.jsx` lọc Thôn → Tổ ở phía server (không tải hết danh sách rồi lọc client).

### 2.3 Thôn / Địa bàn
```
page:ThonXom ──uses──> fe-service:villageService ──calls──> route:village.routes
route:village.routes ──uses──> be-service:VillageService ──uses──> repo-pg:VillageRepo ──reads_writes──> model-pg:Village
```
`VillageService.remove()` có guard nghiệp vụ: chặn xoá thôn còn hộ dân (đếm qua `HouseholdRepo`), trả lỗi rõ nghĩa thay vì để Postgres FK constraint ném lỗi 500 thô.

### 2.4 Thông báo & Khảo sát
```
page:ThongBao, page:NguoiNhan, page:KhaoSat, page:BaoCaoThongBao
  ──uses──> fe-service:notificationService ──calls──> route:notification.routes
route:notification.routes ──uses──> be-service:NotificationService
  ──uses──> repo-pg:NotificationRepo ──reads_writes──> model-pg:Notification, NotificationRecipient, NotificationAttachment, NotificationSend, NotificationFeedback
  ──uses──> repo-pg:RecipientGroupRepo ──reads_writes──> model-pg:RecipientGroup, RecipientGroupMember
  ──uses──> repo-pg:SurveyRepo ──reads_writes──> model-pg:Survey, SurveyQuestion, SurveyResponse
be-service:NotificationService ──uses──> be-service:EmailService   (gửi kênh EMAIL)
be-service:NotificationService ──uses──> be-service:ZaloService    (gửi kênh ZALO)
route:notification.routes (gửi/lên lịch/huỷ) ──protected_by──> middleware:auth.middleware.requireSendPermission()
```
**Phát hiện code rác:** `backend/src/models/mongo/Notification.js` (collection `notifications` trong Mongo, khác với `model-pg:Notification` trong Postgres) — **không có route/service nào require() file này**. Đây là model mồ côi (dead code), nhiều khả năng là bản nháp ban đầu trước khi hệ thống chuyển hẳn sang lưu thông báo ở Postgres. Không xoá tự động — cần xác nhận với người duy trì code trước khi xoá.

### 2.5 Zalo OA & Followers
```
component:ZaloFollowersModal ──uses──> fe-service:zaloService ──calls──> route:zalo.routes
route:zalo.routes ──uses──> be-service:ZaloService
  ──uses──> repo-mongo:ZaloConfigRepo ──reads_writes──> model-mongo:ZaloConfig   (access/refresh token OA)
  ──uses──> repo-mongo:ZaloFollowerRepo ──reads_writes──> model-mongo:ZaloFollower
  ──uses──> repo-mongo:ZaloSessionRepo ──reads_writes──> model-mongo:ZaloSession
route:zalo.routes (webhook) ──writes──> model-mongo:ZaloEvent
route:zalo.routes ──cross_reads──> repo-pg:MemberRepo, repo-pg:NotificationRepo   (liên kết follower ↔ nhân khẩu, gửi qua Zalo)
```
Webhook `POST /api/zalo/webhook` không qua `authenticate` (Zalo server gọi trực tiếp, xác thực bằng chữ ký riêng) — node này nhạy về bảo mật, cần giữ nguyên logic verify hiện có khi chỉnh sửa.

### 2.6 Báo cáo, Xuất file & Audit
```
page:BaoCao ──uses──> fe-service:reportService ──calls──> route:report.routes
route:report.routes ──uses──> be-service:ReportService ──uses──> repo-mongo:ReportCacheRepo ──reads_writes──> model-mongo:ReportCache (TTL cache)
route:report.routes ──uses──> be-service:ExportService   (xuất Excel/PDF)
be-service:AuditService ──uses──> repo-mongo:AuditLogRepo ──reads_writes──> model-mongo:AuditLog
  (mọi service nghiệp vụ — Household/Member/Movement/Village/Notification — đều gọi AuditService.log() sau mutation)
```

### 2.7 Cài đặt & Quản lý người dùng
```
page:CaiDat, page:NhanSu ──uses──> fe-service:authService ──calls──> route:auth.routes (GET/PUT /users, /users/:id)
```
`CaiDat.jsx` (Tài khoản & Mật khẩu, Quản lý người dùng, Bảo mật & Phân quyền) và `NhanSu.jsx` (Cán bộ – Nhân sự) trùng nhau một phần chức năng tạo tài khoản — cả hai cùng gọi `authService.createUser`, là chủ đích thiết kế (cập nhật 2026-06-21) để SUPER_ADMIN có thể thêm tài khoản ngay từ Cài đặt mà không cần rời trang.

### 2.8 Trang chưa nối backend (UI tĩnh / mock)
```
page:PhanAnh, page:TinTuc, page:VanBan  ──(không gọi fe-service nào)──  KHÔNG có route/be-service/model tương ứng
```
Ba trang này hiển thị dữ liệu cứng trong component, **chưa có API thật** — không phải lỗi, mà là tính năng chưa triển khai phần backend. Cần biết điều này trước khi báo cáo "đã hoàn thành" các module Phản ánh kiến nghị / Tin tức / Quản lý văn bản.

## 3. Hạ tầng dữ liệu (cross-cutting)

| | PostgreSQL (Neon, qua Prisma) | MongoDB (qua Mongoose) |
|---|---|---|
| Vai trò | Dữ liệu quan hệ lõi: hộ dân, nhân khẩu, thôn, tài khoản, thông báo, khảo sát | Dữ liệu phụ trợ: audit log, search index, cache báo cáo, cấu hình/sự kiện Zalo |
| Quản lý schema | `prisma db push` (KHÔNG có `prisma/migrations/`) — đổi schema áp trực tiếp vào DB đang chạy | Schema mềm (Mongoose), không cần migrate |
| Vòng đời | Sống lâu, là nguồn sự thật (source of truth) | Có thể xoá/rebuild (`ReportCache` có TTL, `SearchIndex` rebuild được từ Postgres) |

**Lưu ý vận hành quan trọng:** `backend/.env` → `DATABASE_URL` trỏ tới Neon Postgres `ep-shiny-scene-aob8gpph-pooler...` — không có DB dev/staging riêng. Mọi `prisma db push` chạy trực tiếp lên dữ liệu thật.

## 4. Quy tắc phân quyền (RBAC) — tổng hợp từ `requireRole()` thực tế trong route

| Module | SUPER_ADMIN | ADMIN_VILLAGE | VIEWER |
|---|---|---|---|
| Hộ dân / Nhân khẩu / Biến động | Toàn quyền | Thêm, sửa (không xoá hộ) | Chỉ xem |
| Thôn / Địa bàn | Toàn quyền | Sửa (không thêm/xoá) | Chỉ xem |
| Thông báo & Khảo sát | Toàn quyền | Soạn, gửi (nếu được cấp `canSendNotification`) | Chỉ xem |
| Zalo OA (followers, cấu hình) | Toàn quyền | Xem, đồng bộ, gửi (nếu được cấp quyền) | Không truy cập |
| Báo cáo & Xuất file | Toàn quyền | Xem, xuất | Xem, xuất |
| Quản lý tài khoản | Toàn quyền | Không truy cập | Không truy cập |

Bảng này cũng được hiển thị trực tiếp cho người dùng tại `Cài đặt → Bảo mật & Phân quyền` (`CaiDat.jsx`, `PERMISSION_MATRIX`).

## 5. Phát hiện trong lần kiểm tra này (2026-06-21)

| Phát hiện | Vị trí | Mức độ | Khuyến nghị |
|---|---|---|---|
| Model Mongo mồ côi, không ai `require()` | `backend/src/models/mongo/Notification.js` | Thấp (không ảnh hưởng runtime) | Xác nhận rồi xoá, hoặc giữ lại nếu có kế hoạch dùng |
| 3 trang UI chưa nối API thật | `PhanAnh.jsx`, `TinTuc.jsx`, `VanBan.jsx` | Thông tin | Không phải lỗi — cần biết để không báo cáo nhầm là "đã xong" |
| `eslint-plugin-react-hooks` báo lỗi hook gọi có điều kiện | `ZaloFollowersModal.jsx` (11 lỗi `rules-of-hooks`) | **Cần sửa** | Lỗi có sẵn từ trước, không phải do các thay đổi Thôn/Tổ/Sidebar/CaiDat — nên xử lý riêng vì có thể gây crash khi component re-render theo điều kiện khác |

Không phát hiện code rác (file tạm, console.log debug, biến chết) trong các thay đổi của phiên làm việc gần nhất (Tổ/Sidebar/CaiDat/Bảo mật).
