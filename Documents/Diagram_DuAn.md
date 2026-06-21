# Sơ đồ kiến trúc & luồng dữ liệu — Dự án TIENICHOAZALO_HOATIEN

> Toàn bộ sơ đồ dùng cú pháp **Mermaid** — render trực tiếp trên GitHub, GitLab, VS Code (extension Markdown Preview Mermaid) hoặc https://mermaid.live. Nội dung khớp 1:1 với [GraphRAG_DuAn.md](GraphRAG_DuAn.md).

## 1. Kiến trúc tổng thể (Deployment)

```mermaid
flowchart TB
    subgraph Client["Trình duyệt"]
        FE["React 19 + Vite\nadmin-dashboard"]
    end

    subgraph Vercel["Vercel"]
        FE
        REWRITE["vercel.json\nrewrite /api/* → Render"]
    end

    subgraph Render["Render.com"]
        BE["Express API\n(backend/server.js)"]
    end

    subgraph Neon["Neon (PostgreSQL)"]
        PG[("Dữ liệu lõi:\nHộ dân, Nhân khẩu, Thôn,\nTài khoản, Thông báo, Khảo sát")]
    end

    subgraph Atlas["MongoDB Atlas"]
        MG[("Dữ liệu phụ trợ:\nAudit log, Search index,\nReport cache, Zalo config/events")]
    end

    subgraph Zalo["Zalo OA Platform"]
        ZOA["Zalo Official Account API"]
    end

    FE -->|"REST JSON, JWT Bearer"| REWRITE --> BE
    BE -->|Prisma| PG
    BE -->|Mongoose| MG
    BE <-->|webhook + gửi tin| ZOA
```

## 2. Sơ đồ ERD — PostgreSQL (Prisma)

```mermaid
erDiagram
    Village ||--o{ Household : "có nhiều"
    Village ||--o{ AdminUser : "phụ trách (N-N)"
    Household ||--o{ Member : "gồm"
    Household ||--o{ MovementRecord : "ghi nhận"
    AdminUser ||--o{ MovementRecord : "thực hiện"
    AdminUser ||--o{ Notification : "tạo"
    AdminUser ||--o{ RecipientGroup : "tạo"
    Notification ||--o{ NotificationRecipient : "gửi tới"
    Notification ||--o{ NotificationAttachment : "đính kèm"
    Notification ||--o{ NotificationSend : "phát sinh"
    Notification ||--o{ Survey : "kèm khảo sát"
    NotificationSend ||--o{ NotificationFeedback : "nhận phản hồi"
    RecipientGroup ||--o{ RecipientGroupMember : "gồm"
    Member ||--o{ RecipientGroupMember : "thuộc nhóm"
    Member ||--o{ NotificationRecipient : "là người nhận"
    Member ||--o{ NotificationSend : "nhận tin"
    Survey ||--o{ SurveyQuestion : "gồm"
    Survey ||--o{ SurveyResponse : "nhận trả lời"

    Household {
        string id PK
        string soHoKhau
        string diaChi
        string to "Tổ - thêm 2026-06-21"
        float lat
        float lng
        enum trangThai
        enum loaiHo
        string villageId FK
    }
    Member {
        string id PK
        string hoTen
        string cccd
        string householdId FK
        boolean laChuHo
        enum trangThai
    }
    Village {
        string id PK
        string ma
        string ten
        string truongThon
    }
    AdminUser {
        string id PK
        string username
        enum role "SUPER_ADMIN | ADMIN_VILLAGE | VIEWER"
        boolean canSendNotification
    }
    MovementRecord {
        string id PK
        enum loai "MOVE_IN | MOVE_OUT"
        datetime ngay
        string householdId FK
        string performedById FK
    }
```

`HouseholdRelation` (tách/gộp hộ) không có quan hệ Prisma chính thức tới `Household` — chỉ lưu `sourceId`/`targetId` dạng string tự do, nên không vẽ trong ERD ở trên; xử lý logic nằm hoàn toàn ở `HouseholdService.splitHousehold()` / `mergeHouseholds()`.

## 3. Sơ đồ thành phần Frontend ↔ Backend ↔ Database

```mermaid
flowchart LR
    subgraph FE["Frontend (Web/admin-dashboard/src)"]
        direction TB
        P1["pages/HoSo.jsx\npages/BienDong.jsx"]
        P2["pages/ThonXom.jsx"]
        P3["pages/ThongBao.jsx\npages/NguoiNhan.jsx\npages/KhaoSat.jsx"]
        P4["components/ZaloFollowersModal.jsx"]
        P5["pages/BaoCao.jsx"]
        P6["pages/CaiDat.jsx\npages/NhanSu.jsx"]
        S1["services/householdService.js\nmemberService.js\nmovementService.js"]
        S2["services/villageService.js"]
        S3["services/notificationService.js"]
        S4["services/zaloService.js"]
        S5["services/reportService.js"]
        S6["services/authService.js"]
        P1 --> S1
        P2 --> S2
        P3 --> S3
        P4 --> S4
        P5 --> S5
        P6 --> S6
    end

    subgraph BE["Backend (backend/src)"]
        direction TB
        R1["household / member / movement\n.routes.js"]
        R2["village.routes.js"]
        R3["notification.routes.js"]
        R4["zalo.routes.js"]
        R5["report.routes.js"]
        R6["auth.routes.js"]
        MW["auth.middleware\n(authenticate, requireRole,\nrequireSendPermission)"]
        BS1["HouseholdService\nMemberService\nMovementService"]
        BS2["VillageService"]
        BS3["NotificationService\n(+ EmailService, ZaloService)"]
        BS4["ZaloService"]
        BS5["ReportService\nExportService"]
        BS6["AuthService"]
        AUDIT["AuditService"]
        R1 --> MW --> BS1
        R2 --> MW --> BS2
        R3 --> MW --> BS3
        R4 --> MW --> BS4
        R5 --> MW --> BS5
        R6 --> MW --> BS6
        BS1 --> AUDIT
        BS2 --> AUDIT
    end

    subgraph DB["Database"]
        PG[("PostgreSQL\n(Prisma)")]
        MG[("MongoDB\n(Mongoose)")]
    end

    S1 -->|HTTP/JSON| R1
    S2 -->|HTTP/JSON| R2
    S3 -->|HTTP/JSON| R3
    S4 -->|HTTP/JSON| R4
    S5 -->|HTTP/JSON| R5
    S6 -->|HTTP/JSON| R6

    BS1 --> PG
    BS2 --> PG
    BS3 --> PG
    BS5 -.->|cache| MG
    BS4 --> MG
    AUDIT --> MG
```

## 4. Luồng đăng nhập & xác thực (Sequence)

```mermaid
sequenceDiagram
    participant U as Người dùng
    participant L as Login.jsx
    participant AC as AuthContext
    participant API as authService.js
    participant R as auth.routes.js
    participant AS as AuthService
    participant DB as PostgreSQL (AdminUser)

    U->>L: Nhập username/password
    L->>API: login(username, password)
    API->>R: POST /api/auth/login
    R->>AS: AuthService.login()
    AS->>DB: findByUsername + so sánh bcrypt hash
    DB-->>AS: AdminUser (role, canSendNotification)
    AS-->>R: { token JWT, user }
    R-->>API: 200 OK
    API-->>AC: lưu token + user vào context/localStorage
    AC-->>L: đăng nhập thành công
    L->>U: chuyển hướng → /dashboard
```

## 5. Luồng "Thêm hộ dân" kèm phân loại Thôn/Tổ (Sequence — cập nhật 2026-06-21)

```mermaid
sequenceDiagram
    participant U as Cán bộ thôn
    participant P as HoSo.jsx
    participant API as householdService.js
    participant R as household.routes.js
    participant MW as auth.middleware
    participant S as HouseholdService
    participant Repo as HouseholdRepo
    participant PG as PostgreSQL
    participant Cache as ReportCacheRepo (Mongo)
    participant Audit as AuditService (Mongo)

    U->>P: Điền form (Số HK, Địa chỉ, Tổ, Thôn, Loại hộ)
    P->>API: create({ soHoKhau, diaChi, to, villageId, ... })
    API->>R: POST /api/households
    R->>MW: requireRole(SUPER_ADMIN, ADMIN_VILLAGE)
    MW-->>R: OK
    R->>S: HouseholdService.create()
    S->>Repo: findBySoHoKhau() — check trùng
    Repo->>PG: SELECT
    S->>Repo: create({ soHoKhau, diaChi, to, ... })
    Repo->>PG: INSERT households
    S->>Audit: log(CREATE, household)
    S->>Cache: invalidateAll()
    S-->>R: household mới
    R-->>P: 201 Created
    P->>API: getToList(villageId) — nạp lại dropdown Tổ
    API->>R: GET /api/households/to-list?villageId=
    R-->>P: ["Tổ 1","Tổ 2",...]
```

## 6. Luồng gửi thông báo qua Zalo (Sequence)

```mermaid
sequenceDiagram
    participant U as Cán bộ
    participant P as ThongBao.jsx
    participant API as notificationService.js
    participant R as notification.routes.js
    participant MW as requireSendPermission()
    participant S as NotificationService
    participant Zalo as ZaloService
    participant ZOA as Zalo OA Platform
    participant PG as PostgreSQL

    U->>P: Soạn thông báo, chọn nhóm nhận, bấm Gửi
    P->>API: send(notificationId)
    API->>R: POST /api/notify/notifications/:id/send
    R->>MW: kiểm tra canSendNotification
    alt Không có quyền gửi
        MW-->>R: 403 Forbidden
        R-->>P: Lỗi: không có quyền gửi
    else Có quyền gửi
        MW-->>R: OK
        R->>S: NotificationService.send()
        S->>PG: lấy danh sách recipient (Member/RecipientGroup)
        loop mỗi người nhận
            S->>Zalo: ZaloService.pushMessage(zaloUserId, content)
            Zalo->>ZOA: gọi Zalo OA Send API
            ZOA-->>Zalo: kết quả gửi
            S->>PG: ghi NotificationSend (trạng thái)
        end
        S-->>R: tóm tắt kết quả gửi
        R-->>P: 200 OK
    end
```

## 7. Bản đồ điều hướng Sidebar (Site map)

```mermaid
flowchart TD
    Root["UBND Xã Hòa Tiến\n(Sidebar)"]
    Root --> G1["Menu chính"]
    G1 --> Dashboard["/dashboard\nTổng quan"]

    Root --> G2["Hành chính"]
    G2 --> HoSo["/ho-so\nHồ sơ dân cư\n(lọc Thôn→Tổ)"]
    G2 --> ThonXom["/thon-xom\nThôn / Địa bàn"]
    G2 --> BienDong["/bien-dong\nBiến động dân cư"]
    G2 --> VanBan["/van-ban\nQuản lý văn bản *"]

    Root --> G3["Nội dung"]
    G3 --> TinTuc["/tin-tuc\nTin tức / Thông báo *"]

    Root --> G4["Thông báo"]
    G4 --> ThongBao["/thong-bao\nSoạn & Gửi"]
    G4 --> NguoiNhan["/nguoi-nhan\nNgười nhận / Nhóm"]
    G4 --> KhaoSat["/khao-sat\nKhảo sát nhanh"]
    G4 --> BaoCaoTB["/bao-cao-tb\nBáo cáo hiệu quả"]

    Root --> G5["Công dân"]
    G5 --> PhanAnh["/phan-anh\nPhản ánh kiến nghị *"]

    Root --> G6["Nhân sự & Báo cáo"]
    G6 --> NhanSu["/nhan-su\nCán bộ – Nhân sự"]
    G6 --> BaoCao["/bao-cao\nBáo cáo – Thống kê"]

    Root --> G7["Hệ thống"]
    G7 --> CaiDat["/cai-dat\nCài đặt\n(Tài khoản, Bảo mật & Phân quyền)"]

    classDef mock fill:#fef3c7,stroke:#d97706;
    class VanBan,TinTuc,PhanAnh mock
```
`*` = trang chưa nối API thật (UI tĩnh/mock) — xem mục 2.8 trong [GraphRAG_DuAn.md](GraphRAG_DuAn.md).

## 8. Ma trận phân quyền (trực quan hoá)

```mermaid
flowchart LR
    subgraph Roles
        SA["SUPER_ADMIN"]
        AV["ADMIN_VILLAGE"]
        VW["VIEWER"]
    end
    subgraph Modules
        M1["Hộ dân/Nhân khẩu/Biến động"]
        M2["Thôn/Địa bàn"]
        M3["Thông báo & Khảo sát"]
        M4["Zalo OA"]
        M5["Báo cáo & Xuất file"]
        M6["Quản lý tài khoản"]
    end
    SA -->|Toàn quyền| M1
    SA -->|Toàn quyền| M2
    SA -->|Toàn quyền| M3
    SA -->|Toàn quyền| M4
    SA -->|Toàn quyền| M5
    SA -->|Toàn quyền| M6
    AV -->|Thêm/sửa, không xoá hộ| M1
    AV -->|Chỉ sửa| M2
    AV -->|Soạn/gửi nếu được cấp quyền| M3
    AV -->|Xem/đồng bộ/gửi nếu được cấp quyền| M4
    AV -->|Xem/xuất| M5
    VW -->|Chỉ xem| M1
    VW -->|Chỉ xem| M2
    VW -->|Chỉ xem| M3
    VW -->|Xem/xuất| M5
```
