# Bộ Sơ Đồ Kỹ Thuật Toàn Diện - Dự án Hoa Tiến

Để một người mới (hoặc hội đồng nghiệm thu) nhìn vào là có thể hiểu **toàn bộ dự án từ tổng quan nghiệp vụ đến chi tiết code chạy như thế nào**, ngành phần mềm có một bộ 5 sơ đồ chuẩn. Dưới đây là bộ sơ đồ đầy đủ nhất cho hệ thống của bạn:

---

## 1. Sơ đồ Kiến trúc Tổng thể (System Architecture Diagram)
*Mục đích: Giúp hiểu hệ thống chạy trên nền tảng nào, hạ tầng ra sao.*

```mermaid
graph TD
    %% Người dùng và Giao diện
    USER["Người Quản Trị (UBND)"] -->|Thao tác web| UI["Frontend\n(React/Vercel)"]
    CITIZEN["Người Dân"] -->|Nhận & Phản hồi| ZALO_APP["App Zalo / Email"]
    
    %% Luồng API
    UI -->|Gọi API (REST)| BE["Backend API\n(Node.js / Express trên Bizfly VPS)"]
    ZALO_APP -->|Webhook phản hồi| BE
    
    %% Cơ sở dữ liệu (Hybrid)
    subgraph Lưu Trữ (Databases)
        BE -->|Ghi dữ liệu lõi\n(Prisma)| PG[("PostgreSQL\n(Hộ dân, Cán bộ, Lịch sử)")]
        BE -->|Ghi log/cấu hình\n(Mongoose)| MG[("MongoDB\n(Audit Log, Zalo Token)")]
    end
    
    %% Kênh tương tác bên ngoài
    subgraph Các kênh gửi thông báo
        BE -->|Gọi API| ZALO_OA["Zalo OA API"]
        BE -->|SMTP| EMAIL_SERVER["Email SMTP"]
    end
    
    ZALO_OA --> ZALO_APP
    EMAIL_SERVER --> ZALO_APP
    
    CRON["Cron Jobs\n(Chạy ngầm mỗi phút)"] -->|Tự động kích hoạt| BE
```

---

## 2. Sơ đồ Use Case (Nghiệp vụ)
*Mục đích: Giúp hiểu Hệ thống này làm được gì và Ai là người dùng chức năng đó.*

```mermaid
flowchart LR
    subgraph Đối Tượng Người Dùng
        SA((Super Admin \nLãnh đạo xã))
        AV((Admin Thôn \nTrưởng thôn))
        ND((Người Dân))
    end

    subgraph Giai đoạn 1: Quản Lý Hành Chính
        UC1(Quản lý Hộ dân & Nhân khẩu)
        UC2(Xử lý Biến động: Tách/Gộp/Chuyển)
        UC11(Xem Báo cáo Thống kê Dân cư)
    end
    
    subgraph Giai đoạn 2: Tiện ích Thông Báo
        UC3(Soạn và Gửi chiến dịch Thông báo)
        UC4(Tạo Nhóm nhận tin theo tiêu chí)
        UC5(Đọc tin nhắn qua Zalo/Email)
        UC6(Làm Khảo sát ý kiến)
    end

    SA --> UC1
    SA --> UC2
    SA --> UC11
    SA --> UC3
    SA --> UC4
    
    AV --> UC1
    AV --> UC4
    
    ND --> UC5
    ND --> UC6
```

---

## 3. Sơ đồ Quan hệ Cơ sở dữ liệu (ERD)
*Mục đích: Giúp đội Database hiểu các bảng dữ liệu móc nối với nhau qua ID như thế nào.*

```mermaid
erDiagram
    VILLAGE {
        String id PK
        String ten
    }
    HOUSEHOLD {
        String id PK
        String soHoKhau
        String villageId FK
    }
    MEMBER {
        String id PK
        String cccd
        String householdId FK
    }
    ADMIN_USER {
        String id PK
        String role
    }
    NOTIFICATION {
        String id PK
        String tieuDe
    }
    NOTIFICATION_SEND {
        String id PK
        String trangThai
        String memberId FK
        String notificationId FK
    }

    VILLAGE ||--o{ HOUSEHOLD : "chứa các"
    HOUSEHOLD ||--o{ MEMBER : "gồm các"
    ADMIN_USER ||--o{ NOTIFICATION : "soạn"
    NOTIFICATION ||--o{ NOTIFICATION_SEND : "phát sinh lượt gửi"
    MEMBER ||--o{ NOTIFICATION_SEND : "nhận tin"
```

---

## 4. Sơ đồ Tuần tự (Sequence Diagram) - Luồng chạy Code
*Mục đích: Giúp Coder hiểu logic code đằng sau tính năng quan trọng nhất - Đặt lịch gửi Zalo.*

```mermaid
sequenceDiagram
    actor Admin
    participant Frontend
    participant API as Backend (Routes/Services)
    participant DB as PostgreSQL
    participant Cron as Cron Job (Chạy ngầm)
    participant Zalo as Máy chủ Zalo
    actor Citizen as Người Dân

    Admin->>Frontend: Soạn tin, chọn gửi lúc 15:00
    Frontend->>API: POST /api/notify
    API->>DB: Lưu DB trạng thái "CHO_GUI" (Pending)
    DB-->>API: OK
    API-->>Frontend: Thông báo "Lên lịch thành công"
    
    Note over Cron: Đúng 15:00 (Hệ thống quét ngầm)
    Cron->>DB: Tìm các tin nhắn "CHO_GUI" & đến giờ
    DB-->>Cron: Trả về danh sách SĐT/Zalo ID
    
    loop Xử lý từng người dân
        Cron->>Zalo: POST API gửi tin Zalo OA
        alt Gửi Thành Công
            Zalo-->>Cron: Success
            Cron->>DB: Cập nhật thành "DA_GUI"
        else Lỗi (Hết hạn token, sai số...)
            Zalo-->>Cron: Error
            Cron->>DB: Cập nhật thành "FAILED"
        end
    end
    Zalo->>Citizen: Điện thoại rung, hiển thị tin nhắn
```

---

## 5. Sơ đồ Cấu trúc Mã nguồn (Backend Component)
*Mục đích: Khi có lỗi, lập trình viên nhìn vào đây để biết cần mở thư mục nào trong VS Code để sửa.*

```mermaid
graph TD
    REQ((HTTP Request)) --> ROUTE[📂 src/routes \n Điều phối URL API]
    ROUTE --> MID[📂 src/middlewares \n Check Token, Check Quyền]
    
    MID -->|Hợp lệ| SERV[📂 src/services \n Viết Logic nghiệp vụ cốt lõi]
    
    SERV --> REPO[📂 src/repositories \n Viết lệnh thao tác DB]
    
    REPO -->|Query SQL| PG[(Prisma \n PostgreSQL)]
    REPO -->|NoSQL| MG[(Mongoose \n MongoDB)]
    
    JOB[📂 src/jobs \n Tiến trình ngầm Node-cron] -->|Định kỳ gọi| SERV
```
