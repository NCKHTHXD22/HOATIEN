# Các luồng xử lý chính — Hệ thống Quản lý Hộ khẩu Xã Hòa Tiến

## 1. Luồng đăng nhập & phân quyền

```
Người dùng nhập username/password (Login.jsx)
  → POST /api/auth/login
  → AuthService kiểm tra passwordHash (bcrypt) + isActive
  → Trả JWT (chứa userId, role, hết hạn theo JWT_EXPIRES_IN)
  → Frontend lưu token (AuthContext), đính kèm header Authorization cho mọi request sau
  → Middleware auth.middleware.authenticate() xác thực token trên từng route bảo vệ
  → requireRole(...roles) kiểm tra quyền truy cập theo vai trò (SUPER_ADMIN/ADMIN_VILLAGE/VIEWER)
```

## 2. Luồng quản lý hộ dân (CRUD cơ bản)

```
HoSo.jsx → load() → GET /api/households?loaiHo=&page=&limit=
  → HouseholdService.getAll → HouseholdRepo.findAll (Prisma, kèm phân trang)

Thêm hộ:  Modal "Thêm hộ dân" → POST /api/households
  → kiểm tra trùng soHoKhau → tạo Household + Member ban đầu (nếu có)
  → AuditService.log(CREATE) → SearchService.syncIndex() → ReportCacheRepo.invalidateAll()

Sửa hộ:   PUT /api/households/:id → tương tự, AuditService.log(UPDATE, diff)

Xóa hộ:   DELETE /api/households/:id → AuditService.log(DELETE) → invalidate cache
```

## 3. Luồng tách hộ (UC05)

```
Mở chi tiết hộ (HoSo.jsx) → tab "Tách hộ" → chọn các thành viên cần tách
  → POST /api/households/:id/split { memberIds, newHeadId?, newDiaChi?, newVillageId? }
  → HouseholdService.splitHousehold thực hiện trong 1 Prisma transaction:
      1. Tạo Household mới (soHoKhau tự sinh: "<gốc>-T<timestamp>")
      2. Chuyển memberIds sang household mới, gỡ cờ laChuHo cũ
      3. Gán laChuHo cho newHeadId (nếu có)
      4. Nếu hộ gốc hết thành viên → đánh dấu trangThai = DA_TACH
      5. Ghi HouseholdRelation (type SPLIT, sourceId, targetId, memberIds)
  → AuditService.log(SPLIT) cho cả hộ gốc và hộ mới
  → SearchService.syncIndex() cho cả 2 hộ → invalidate report cache
```

## 4. Luồng gộp hộ (UC06)

```
HoSo.jsx → "Gộp hộ" → chọn 1 hộ nhận (target) + nhiều hộ nguồn (sources)
  → POST /api/households/merge { targetId, sourceIds[], ghiChu }
  → HouseholdService.mergeHouseholds trong 1 Prisma transaction, với mỗi hộ nguồn:
      1. Lấy danh sách member ACTIVE → chuyển householdId sang target, gỡ laChuHo
      2. Nếu hộ nguồn đang ACTIVE → đánh dấu DA_GIAI_THE
      3. Ghi HouseholdRelation (type MERGE)
      4. Tự tạo MovementRecord MOVE_IN cho hộ nhận (ghi rõ nguồn gốc, có/không khác thôn)
  → AuditService.log(MERGE) cho từng hộ nguồn + hộ nhận
  → SearchService.syncIndex() → invalidate report cache
```

## 5. Luồng ghi nhận biến động dân cư (UC07/08 — chuyển đến/chuyển đi)

Có 2 điểm vào, dùng chung backend:

```
(a) Trong chi tiết hộ dân (HoSo.jsx, tab "Biến động")
(b) Trang tổng hợp toàn xã (BienDong.jsx) — chọn hộ dân từ danh sách

  → POST /api/movements { householdId, loai, ngay, nguonGoc, noiDen, ghiChu }
  → MovementService.create → kiểm tra Household tồn tại → MovementRepo.create
  → AuditService.log(MOVE_IN | MOVE_OUT) → invalidate report cache

Sửa:  PATCH /api/movements/:id  → MovementService.update → AuditService.log(UPDATE)
Xóa:  DELETE /api/movements/:id → MovementService.remove → AuditService.log(DELETE)

Trang BienDong.jsx lọc theo: loại (Tabs) / thôn (villageId) / khoảng ngày (fromDate–toDate)
  → GET /api/movements?villageId=&loai=&fromDate=&toDate=&page=
  → MovementRepo.findAll áp where theo household.villageId (join qua Prisma include)
```

## 6. Luồng xóa thôn (có ràng buộc)

```
ThonXom.jsx → "Xóa" → window.confirm → DELETE /api/villages/:id
  → VillageService.remove:
      1. VillageRepo.findById (kèm _count.households)
      2. Nếu householdCount > 0 → throw Error rõ ràng (chặn xóa, không cascade)
      3. Nếu = 0 → xóa thật, AuditService.log(DELETE), invalidate report cache
  → Lỗi (nếu có) trả qua error middleware → frontend alert() hiển thị nguyên văn thông báo
```

## 7. Luồng tra cứu hộ khẩu qua Zalo OA (chatbot)

```
Người dân chat với OA → Zalo gửi webhook → POST /api/zalo/webhook { user_id_by_app, message }
  → ZaloEvent.create (lưu log) → ZaloService.handleMessage(zaloUserId, text)
      → Lấy/khởi tạo session (ZaloSessionRepo, state machine: IDLE/AWAIT_TYPE/AWAIT_QUERY/SHOWING_RESULT)
      → Theo state hiện tại, parse lựa chọn (1=tên, 2=CCCD, 3=SĐT) hoặc giá trị tra cứu
      → _search(): tên → SearchService.searchByText() (fallback ILIKE Postgres nếu rỗng)
                    CCCD/SĐT → MemberRepo trực tiếp trên Postgres
      → formatZaloReply() định dạng kết quả thành text
      → Lưu lại session mới + ZaloEvent (SEARCH, resultCount)
  → ZaloConfigRepo.getValidToken() → gọi Zalo OA Message API (v3.0) gửi trả lời
```

## 8. Luồng cấp quyền & làm mới token Zalo OA

```
SUPER_ADMIN → GET /api/zalo/auth-url → mở URL Zalo OAuth (app_id + redirect_uri)
  → Cấp quyền trên Zalo → Zalo redirect về GET /api/zalo/callback
      (a) Nếu Zalo trả thẳng oa_access_token → lưu ngay
      (b) Nếu trả code → POST đổi code lấy access_token/refresh_token (oauth.zaloapp.com)
  → ZaloConfigRepo.saveTokens() lưu Redis (TTL) + Mongo

Job nền zaloTokenRefreshJob (chạy định kỳ trong server.js):
  → Kiểm tra TTL access token còn lại
  → Nếu gần hết hạn → gọi refresh bằng refresh_token → lưu token mới
```

## 9. Luồng soạn & gửi thông báo đa kênh

```
ThongBao.jsx → soạn nội dung, chọn kênh gửi (Zalo/SMS/Email), chọn người nhận
  (cá nhân hoặc RecipientGroup — tạo qua NguoiNhan.jsx, thủ công hoặc AUTO theo tiêu chí)
  → POST /api/notify/notifications (trạng thái NHAP) → có thể đính kèm file
  → Gửi ngay: POST /api/notify/notifications/:id/send
      hoặc Lên lịch: POST /api/notify/notifications/:id/schedule (trạng thái CHO_GUI)
  → NotificationService.expandRecipients(): RecipientGroup → danh sách Member cụ thể
  → Với mỗi Member: tạo NotificationSend (trạng thái PENDING)
      → gửi theo kênh: Zalo (ZaloService.sendMessage), SMS (ESMS.vn), Email (Gmail SMTP)
      → cập nhật NotificationSend.trangThai = SENT/FAILED, sentAt
  → Người nhận xác nhận/phản hồi: POST /api/notify/sends/:sendId/confirm|feedback
      → trangThai = CONFIRMED, lưu NotificationFeedback
  → BaoCaoThongBao.jsx: GET /api/notify/reports — tỷ lệ gửi thành công/đọc/phản hồi 30 ngày gần nhất

Job nền startScheduledNotificationsJob(): quét Notification có trangThai=CHO_GUI
  và scheduledAt <= now → tự động gửi
```

## 10. Luồng khảo sát nhanh (gắn với thông báo)

```
KhaoSat.jsx → tạo Survey (tieuDe, deadline, gắn notificationId) + nhiều SurveyQuestion
  → POST /api/notify/surveys
  → Thông báo gửi kèm link khảo sát → người dân trả lời (không cần đăng nhập):
      POST /api/notify/surveys/:id/respond { memberId?, answers }
  → GET /api/notify/surveys/:id/results — tổng hợp số lượng theo từng lựa chọn/câu hỏi
```

## 11. Luồng đồng bộ báo cáo / dashboard (chống dữ liệu cũ)

```
Mọi service có thao tác tạo/sửa/xóa/tách/gộp (Village/Household/Member/Movement)
  → sau khi ghi Postgres + AuditLog → gọi ReportCacheRepo.invalidateAll()
      (xóa toàn bộ cache "stats_by_village" và "total_summary" trong MongoDB)

Dashboard.jsx / BaoCao.jsx mount → GET /api/reports/summary, /by-village, /movements
  → ReportService kiểm tra cache (Mongo, TTL 30–60p):
      - Nếu có cache hợp lệ → trả ngay (nhanh)
      - Nếu không (vừa bị invalidate hoặc hết TTL) → query lại Prisma, lưu cache mới
  → Nhờ bước invalidate ở trên, số liệu hiển thị luôn khớp với dữ liệu vừa thay đổi,
    không phải chờ cache tự hết hạn.
```

## 12. Luồng xuất báo cáo Excel/PDF/CSV

```
BaoCao.jsx → nút "Excel"/"PDF" → GET /api/reports/export/excel|pdf (responseType: blob)
  → ExportService dùng ExcelJS/PDFKit, lấy dữ liệu từ ReportService
      (Tổng quan, Theo thôn, Biến động) → định dạng tiêu đề/số liệu → stream file về client
  → Frontend tạo Blob → trigger download

Xuất CSV (phía client, không gọi API): downloadCsv() build chuỗi CSV từ state hiện có
  trên trang (summary, byVillage, movStats) → tạo Blob → download trực tiếp trong browser
```
