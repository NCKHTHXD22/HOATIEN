# KIẾN TRÚC HYBRID DATABASE
## PostgreSQL + MongoDB
**UBND Xã Hoa Tiến** | Phiên bản: 1.0 | Ngày: 06/06/2026

---

> **Polyglot Persistence** — dùng đúng database cho đúng loại dữ liệu.
> PostgreSQL và MongoDB không phải đối thủ mà là bổ sung cho nhau.
> Mỗi loại có điểm mạnh riêng và phù hợp với các bài toán khác nhau trong cùng một hệ thống.

**Kết luận:** PostgreSQL giữ "source of truth" cho dữ liệu hộ dân. MongoDB xử lý log, cache, Zalo session. Hai DB hoàn toàn độc lập — nếu MongoDB down, nghiệp vụ chính vẫn chạy.

---

## 1. SO SÁNH PostgreSQL vs MongoDB

| 🐘 PostgreSQL | 🍃 MongoDB |
|---|---|
| Dữ liệu có cấu trúc rõ ràng, quan hệ nhiều-nhiều | Dữ liệu linh hoạt, schema có thể thay đổi |
| Cần ACID transaction (tách hộ, gộp hộ) | Ghi nhanh, append-only: log, event stream |
| Query phức tạp: JOIN, GROUP BY, aggregate | Lưu JSON snapshot phức tạp: oldData/newData |
| Báo cáo thống kê: SUM, COUNT, AVG theo thôn | State machine: session trạng thái Zalo |
| Ràng buộc dữ liệu: FK, UNIQUE, NOT NULL | Full-text search: tìm kiếm theo tên |
| Search theo index: CCCD, SĐT cần exact match | Cache kết quả thống kê tổng hợp |
| Schema ổn định, ít thay đổi cấu trúc | Không cần JOIN phức tạp, đọc document trọn vẹn |

---

## 2. PHÂN CHIA DỮ LIỆU

### PostgreSQL — 6 bảng cốt lõi

| Bảng | Dữ liệu | Lý do dùng PostgreSQL |
|---|---|---|
| `villages` | Tên thôn, mã thôn, trưởng thôn | Ít bản ghi, FK reference, ổn định |
| `admin_users` | Username, role, villageIds, zaloUserId | RBAC cần query chính xác, JOIN với villages |
| `households` | soHoKhau, địa chỉ, toaDo, trangThai, loaiHo | Core data — cần ACID, FK, UNIQUE constraint |
| `members` | Họ tên, CCCD, SĐT, ngày sinh, quanHe, laChuHo | Quan hệ 1-N với households, cần FK + index CCCD |
| `movement_records` | householdId, loai, ngay, nguonGoc/noiDen | Dữ liệu biến động — cần JOIN, thống kê theo kỳ |
| `household_relations` | type (SPLIT/MERGE), source_id, target_id, date | Lưu mối quan hệ tách/gộp — cần FK integrity |

### MongoDB — 6 collection linh hoạt

| Collection | Dữ liệu | Lý do dùng MongoDB |
|---|---|---|
| `audit_logs` | action, oldData (JSON), newData (JSON), diff[], userId, timestamp | JSON snapshot thay đổi — schema phụ thuộc loại action |
| `zalo_sessions` | userId, state, lastQuery, expiredAt, context {} | TTL index, cấu trúc thay đổi theo state machine |
| `zalo_events` | type, userId, payload {}, timestamp, processed | Event stream ghi nhanh, không cần JOIN |
| `report_cache` | cacheKey, data {}, generatedAt, ttl | Kết quả aggregate phức tạp, schema tuỳ báo cáo |
| `notifications` | channel, to, payload {}, sentAt, status | Payload Zalo message không có cấu trúc cố định |
| `search_index` | householdId, tokens [], text, updatedAt | Full-text search — sync từ PostgreSQL khi có thay đổi |

---

## 3. KIẾN TRÚC HỆ THỐNG — 4 TẦNG

| Tầng | Thành phần | Trách nhiệm |
|---|---|---|
| **API Layer** | Express Router (5 router files) | Nhận request, validate input, gọi service |
| **Service Layer** | HouseholdService, ZaloService, AuditService, ReportService, SearchService | Business logic — điều phối cả 2 DB trong 1 transaction logic |
| **Repository Layer** | PrismaClient (PG) + Mongoose (MG) — 2 client riêng biệt | Trừu tượng hoá DB — service không biết DB nào đằng sau |
| **Data Layer** | PostgreSQL (Railway) + MongoDB Atlas — 2 connection độc lập | Lưu trữ — PG cho structured data, MG cho flexible data |

**Nguyên tắc quan trọng:**
- Service layer chịu trách nhiệm điều phối: luôn ghi PG trước, sau đó mới ghi MG (audit log)
- Nếu PG transaction fail → rollback, không ghi MG → dữ liệu nhất quán
- Nếu MG ghi audit fail → **KHÔNG** rollback PG (log là secondary, không block nghiệp vụ)
- Repository layer dùng interface pattern → có thể swap DB mà không sửa service

---

## 4. SCHEMA CHI TIẾT

### PostgreSQL — Prisma Schema

```prisma
model Village {
  id          String      @id @default(cuid())
  ma          String      @unique
  ten         String
  truongThon  String?
  households  Household[]
  admins      AdminUser[]  @relation("AdminVillages")
}

model Household {
  id           String    @id @default(cuid())
  soHoKhau     String    @unique
  diaChi       String
  lat          Float?
  lng          Float?
  trangThai    HoStatus  @default(ACTIVE)
  loaiHo       HoType    @default(THUONG_TRU)
  village      Village   @relation(fields:[villageId], references:[id])
  villageId    String
  members      Member[]
  movements    MovementRecord[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Member {
  id            String       @id @default(cuid())
  hoTen         String
  ngaySinh      DateTime?
  gioiTinh      Gender
  cccd          String?      @unique
  sdt           String?
  quanHeChuHo   String
  laChuHo       Boolean      @default(false)
  trangThai     MemberStatus @default(ACTIVE)
  household     Household    @relation(fields:[householdId], references:[id])
  householdId   String
}

model MovementRecord {
  id            String         @id @default(cuid())
  loai          MovementType   // MOVE_IN | MOVE_OUT
  ngay          DateTime
  nguonGoc      String?        // từ đâu (nếu MOVE_IN)
  noiDen        String?        // đến đâu (nếu MOVE_OUT)
  ghiChu        String?
  household     Household      @relation(fields:[householdId], references:[id])
  householdId   String
  performedBy   AdminUser      @relation(fields:[performedById], references:[id])
  performedById String
}

model HouseholdRelation {
  id            String         @id @default(cuid())
  type          RelationType   // SPLIT | MERGE
  sourceId      String         // hộ gốc
  targetId      String         // hộ tách ra / hộ nhận
  memberIds     String[]       // thành viên chuyển
  date          DateTime       @default(now())
  note          String?
}
```

### MongoDB — Mongoose Schemas

```js
// audit_logs — lưu TOÀN BỘ snapshot
const AuditLogSchema = new Schema({
  entityType : String,           // "household" | "member"
  entityId   : String,           // PostgreSQL ID
  action     : String,           // CREATE|UPDATE|DELETE|SPLIT|MERGE|MOVE_IN|MOVE_OUT
  oldData    : Schema.Types.Mixed,  // snapshot trước (bất kỳ cấu trúc)
  newData    : Schema.Types.Mixed,  // snapshot sau
  diff       : [{ field, from, to }],
  performedBy: String,           // AdminUser ID (từ PG)
  performedAt: { type: Date, default: Date.now, index: true },
  note       : String,
}, { collection: "audit_logs" });

// zalo_sessions — TTL tự xoá sau 30 phút
const ZaloSessionSchema = new Schema({
  zaloUserId  : { type: String, unique: true },
  state       : String,          // IDLE|AWAIT_TYPE|AWAIT_QUERY|SHOWING
  queryType   : String,          // "name"|"cccd"|"sdt"
  lastQuery   : String,
  resultCount : Number,
  expiredAt   : { type: Date, expires: 0 },  // TTL index
});

// search_index — sync từ PG, phục vụ full-text
const SearchIndexSchema = new Schema({
  householdId : String,          // PostgreSQL ID
  tokens      : [String],        // mảng từ khoá: họ tên, địa chỉ, thôn
  chuHoName   : String,
  villageName : String,
  soHoKhau    : String,
  updatedAt   : Date,
});
SearchIndexSchema.index({ tokens: "text", chuHoName: "text" });
```

---

## 5. WORKFLOW CÁC NGHIỆP VỤ CHÍNH

### 5.1 Tạo hộ mới (UC01)

| Bước | Hành động | DB | Ghi chú |
|---|---|---|---|
| 1 | Validate request: soHoKhau unique, villageId tồn tại | PostgreSQL | SELECT count(*) WHERE soHoKhau = ? |
| 2 | INSERT INTO households + INSERT INTO members (batch) | PostgreSQL | Trong 1 transaction |
| 3 | INSERT audit_logs { action: CREATE, newData: household } | MongoDB | Sau khi PG commit xong |
| 4 | INSERT search_index { householdId, tokens[] } | MongoDB | Build token cho full-text search |
| 5 | Return household data | — | Lấy từ PostgreSQL |

### 5.2 Cập nhật hộ (UC02)

| Bước | Hành động | DB | Ghi chú |
|---|---|---|---|
| 1 | SELECT * FROM households WHERE id = ? (lấy oldData) | PostgreSQL | Snapshot trước khi sửa |
| 2 | BEGIN TRANSACTION | PostgreSQL | |
| 3 | UPDATE households SET ... WHERE id = ? | PostgreSQL | |
| 4 | UPDATE members SET ... (nếu có sửa thành viên) | PostgreSQL | |
| 5 | COMMIT | PostgreSQL | |
| 6 | computeDiff(oldData, newData) → diff[] | — | Tính toán ở service layer |
| 7 | INSERT audit_logs { UPDATE, oldData, newData, diff } | MongoDB | Ghi sau PG commit |
| 8 | UPDATE search_index { tokens[] } | MongoDB | Cập nhật search cache |

### 5.3 Tách hộ (UC05) — Phức tạp nhất

> Đây là nghiệp vụ quan trọng nhất cần 2 DB phối hợp: PG đảm bảo integrity, MG ghi lịch sử đầy đủ.

| Bước | Hành động | DB | Ghi chú |
|---|---|---|---|
| 1 | Validate: memberIds thuộc hộ nguồn, newHeadId hợp lệ | PostgreSQL | |
| 2 | BEGIN TRANSACTION | PostgreSQL | |
| 3 | INSERT INTO households (hộ mới) → newHouseholdId | PostgreSQL | |
| 4 | UPDATE members SET householdId = newHouseholdId, laChuHo = ... WHERE id IN (...) | PostgreSQL | |
| 5 | UPDATE households SET trangThai = DA_TACH WHERE id = sourceId (nếu còn 0 thành viên) | PostgreSQL | |
| 6 | INSERT INTO household_relations { type: SPLIT, sourceId, targetId: newId, memberIds } | PostgreSQL | |
| 7 | COMMIT | PostgreSQL | |
| 8 | INSERT audit_logs x2: 1 cho hộ nguồn, 1 cho hộ mới | MongoDB | action=SPLIT |
| 9 | INSERT search_index cho hộ mới | MongoDB | |
| 10 | UPDATE search_index cho hộ nguồn | MongoDB | |

### 5.4 Tra cứu Zalo OA (UC16) — Luồng 2 DB trong 1 request

| Bước | Hành động | DB | Ghi chú |
|---|---|---|---|
| 1 | Webhook nhận tin nhắn từ Zalo → userId, text | — | |
| 2 | GET zalo_sessions WHERE zaloUserId = userId | MongoDB | Lấy state hiện tại |
| 3 | State machine xử lý: IDLE → AWAIT_TYPE | — | Logic trong memory |
| 4 | Người dùng chọn loại → AWAIT_QUERY, cập nhật session | MongoDB | UPSERT zalo_sessions |
| 5 | Người dùng nhập query → tìm kiếm | — | |
| 6a | Nếu query text: $text search trong search_index | MongoDB | Full-text search nhanh |
| 6b | Lấy householdId từ MG → SELECT FROM households JOIN members WHERE id IN (...) | PostgreSQL | Lấy data chính xác từ PG |
| 6c | Nếu query CCCD/SĐT: WHERE members.cccd = ? (exact match) | PostgreSQL | Index query, chính xác hơn |
| 7 | INSERT zalo_events { type: SEARCH, userId, query, results } | MongoDB | Log tra cứu |
| 8 | UPDATE zalo_sessions state → SHOWING_RESULT + TTL reset | MongoDB | TTL 30 phút |
| 9 | Format kết quả (chỉ: tên, thôn, số nhân khẩu) | — | **KHÔNG** trả CCCD/SĐT |
| 10 | Gọi Zalo API sendMessage() | — | |

---

## 6. CODE PATTERN — SERVICE LAYER

### HouseholdService.update() — điều phối 2 DB

```js
async updateHousehold(id, newData, performedById) {
  // 1. Lấy snapshot từ PostgreSQL
  const oldData = await this.pgRepo.findHouseholdById(id);
  if (!oldData) throw new NotFoundError();

  // 2. Cập nhật PostgreSQL (transaction)
  const updated = await this.pgRepo.updateHousehold(id, newData);

  // 3. Ghi audit log vào MongoDB (fire-and-forget — không block)
  this.auditService.log({
    entityType: "household",
    entityId: id,
    action: "UPDATE",
    oldData,
    newData: updated,
    diff: computeDiff(oldData, updated),
    performedBy: performedById,
  }).catch(err => logger.error("Audit log failed", err)); // không throw

  // 4. Sync search index (bất đồng bộ)
  this.searchService.syncIndex(id).catch(() => {});

  return updated;
}
```

### ZaloService.handleMessage() — Kết hợp MG → PG → MG

```js
async handleMessage(zaloUserId, text) {
  // 1. Lấy state từ MongoDB
  let session = await ZaloSession.findOne({ zaloUserId });
  if (!session) session = { state: "IDLE" };

  const { nextState, reply, query } = this.stateMachine(session, text);
  let results = [];

  if (query) {
    if (query.type === "name") {
      // Full-text: tìm trong MongoDB search_index trước
      const ids = await SearchIndex.find({ $text: { $search: query.value } })
                                    .select("householdId").lean();
      // Lấy data đầy đủ từ PostgreSQL
      results = await prisma.household.findMany({
        where: { id: { in: ids.map(i => i.householdId) } },
        include: { members: { where: { laChuHo: true } }, village: true },
      });
    } else {
      // CCCD / SĐT: query trực tiếp PostgreSQL (exact match)
      results = await prisma.household.findMany({
        where: { members: { some: { [query.type]: query.value } } },
        include: { members: true, village: true },
      });
    }
  }

  // Ghi log + cập nhật session vào MongoDB
  await ZaloEvent.create({ type:"SEARCH", zaloUserId, query, resultCount: results.length });
  await ZaloSession.updateOne({ zaloUserId }, { state: nextState }, { upsert: true });

  return formatZaloReply(results); // chỉ trả tên + thôn + số nhân khẩu
}
```

---

## 7. ĐỒNG BỘ DỮ LIỆU GIỮA 2 DB

**Search Index Sync Strategy:**
- **Real-time sync:** mỗi khi PG thay đổi household/member → async sync search_index trong MG
- **Nightly full re-sync:** job chạy 2:00 AM — rebuild toàn bộ search_index từ PG
- **On-demand fallback:** nếu search_index trả 0 kết quả → fallback LIKE query trực tiếp trên PG

### Xử lý lỗi đồng bộ

| Tình huống | Vấn đề | Giải pháp |
|---|---|---|
| PG update thành công, MG audit fail | Mất audit log | Retry queue: lưu task vào Redis, worker retry 3 lần |
| Search index MG bị lỗi thời | Kết quả tìm kiếm không chính xác | Re-sync job chạy mỗi đêm; hoặc fallback tìm thẳng PG |
| MG down hoàn toàn | Zalo state machine mất session | Fallback: lưu session vào Redis (in-memory cache) |
| PG down | Toàn bộ nghiệp vụ chính ngừng | Health check + alert; Railway auto-restart; read từ MG cache báo cáo |
| Dữ liệu MG search_index không khớp PG | Tìm kiếm trả kết quả sai | Nightly full re-sync job; checksumming householdId |

---

## 8. CẤU HÌNH KẾT NỐI 2 DATABASE

```js
// src/config/database.js
const { PrismaClient } = require("@prisma/client");
const mongoose        = require("mongoose");

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }, // PostgreSQL
  log: process.env.NODE_ENV === "development" ? ["query"] : ["error"],
});

async function connectMongoDB() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "hoa_tien",
    maxPoolSize: 10,
  });
  console.log("MongoDB connected");
}

// server.js — khởi động song song
await Promise.all([
  prisma.$connect(),   // PostgreSQL
  connectMongoDB(),    // MongoDB
]);
```

**Biến môi trường cần thiết:**
```env
DATABASE_URL=postgresql://user:pass@railway.app:5432/hoa_tien
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
```

---

## 9. KẾ HOẠCH TRIỂN KHAI

| Sprint | Thời gian | Công việc | DB liên quan |
|---|---|---|---|
| **Sprint 0** | Tuần 1 | Setup: Railway PG + MongoDB Atlas, Prisma init, Mongoose setup, Docker Compose dev | PG + MG |
| **Sprint 1** | Tuần 2–3 | Auth, CRUD Household + Member (PG), AuditService ghi MG, Search index sync | PG chính, MG audit |
| **Sprint 2** | Tuần 4–5 | Tách/Gộp hộ (PG transaction + MG log), Chuyển đến/đi, MovementRecord | PG + MG |
| **Sprint 3** | Tuần 6–7 | ZaloService: State machine dùng MG session, Full-text search (MG → PG) | MG session + PG data |
| **Sprint 4** | Tuần 8–9 | React Dashboard: Danh sách, form, tìm kiếm, lịch sử (đọc MG audit_logs) | PG + MG |
| **Sprint 5** | Tuần 10–11 | Report: thống kê PG, cache MG; Bản đồ Leaflet; Xuất Excel/PDF | PG aggregate + MG cache |
| **Sprint 6** | Tuần 12–13 | Re-sync job, Retry queue Redis, Health check 2 DB, E2E test | PG + MG + Redis |
| **Sprint 7** | Tuần 14 | Deploy Railway (PG) + Atlas (MG) + Render (API) + Vercel (Web) | Tất cả |

---

## 10. TỔNG KẾT LỢI ÍCH HYBRID ARCHITECTURE

| Tiêu chí | 1 DB (chỉ PG hoặc MG) | Hybrid PG + MG | Lợi ích |
|---|---|---|---|
| **Data integrity** | Chỉ PG đảm bảo tốt | PG giữ toàn bộ dữ liệu cốt lõi | ACID đầy đủ cho nghiệp vụ chính |
| **Audit log** | PG tốn dung lượng lớn (JSON trong PG) | MG lưu JSON snapshot không giới hạn schema | Tiết kiệm 60% storage PG |
| **Zalo session** | PG cần TTL trigger phức tạp | MG TTL index tự xóa sau 30 phút | Đơn giản hóa code |
| **Full-text search** | PG full-text search chậm hơn MG | MG text index tìm nhanh, fallback PG | Search nhanh hơn 3–5x |
| **Flexibility** | PG cứng schema, migration phức tạp | MG cho phần thay đổi schema tự do | Thêm field log không cần migrate |
| **Reliability** | Single point of failure | Nghiệp vụ chính (PG) độc lập MG | MG down không ảnh hưởng CRUD |

---

*— Hết tài liệu kế hoạch Hybrid Database —*
