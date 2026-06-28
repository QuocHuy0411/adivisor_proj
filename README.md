# Adivisor — Hệ Thống Quản Lý Phân Công Cố Vấn Học Tập

> Hệ thống web quản lý và phân công **Cố vấn học tập (CVHT)** cho lớp sinh viên tại PTIT.

Adivisor hỗ trợ toàn bộ quy trình làm việc giữa **Admin**, **Phòng Công tác Sinh viên (CTSV)**, **Trưởng Khoa**, **CVHT** và **Sinh viên**: quản lý tài khoản, import dữ liệu hàng loạt, lập danh sách lớp cần cố vấn, phân công CVHT (thủ công hoặc tự động), xử lý yêu cầu thay thế CVHT và gửi thông báo đúng phạm vi từng vai trò.

---

## Mục Lục

- [Tổng Quan](#tổng-quan)
- [Công Nghệ](#công-nghệ)
- [Kiến Trúc Hệ Thống](#kiến-trúc-hệ-thống)
- [Cấu Trúc Dự Án](#cấu-trúc-dự-án)
- [Cài Đặt Và Khởi Chạy](#cài-đặt-và-khởi-chạy)
- [Cấu Hình Môi Trường](#cấu-hình-môi-trường)
- [Tài Khoản Mẫu](#tài-khoản-mẫu)
- [Database Schema](#database-schema)
- [Vai Trò Và Chức Năng](#vai-trò-và-chức-năng)
- [Luồng Nghiệp Vụ](#luồng-nghiệp-vụ)
- [State Machine](#state-machine)
- [Import Và Export](#import-và-export)
- [API Reference](#api-reference)
- [Quy Tắc Phân Quyền](#quy-tắc-phân-quyền)
- [Hệ Thống Thông Báo](#hệ-thống-thông-báo)
- [Kiểm Thử](#kiểm-thử)
- [Xử Lý Sự Cố](#xử-lý-sự-cố)
- [Ghi Chú Phát Triển](#ghi-chú-phát-triển)

---

## Tổng Quan

Hệ thống bao gồm các nhóm chức năng chính:

| Nhóm | Mô tả |
|------|-------|
| **Xác thực** | Đăng nhập/đăng xuất, JWT session, refresh token, đổi mật khẩu lần đầu, quên mật khẩu qua OTP email, đăng nhập Google OAuth2 |
| **Bảo mật** | Chặn brute-force đăng nhập (max 5 lần sai/ngày), httpOnly cookie, CORS kiểm soát |
| **Admin** | Quản lý tài khoản nhân viên (CTSV, Trưởng Khoa), quản lý thông tin CVHT, import hàng loạt qua CSV |
| **CTSV** | CRUD lớp và sinh viên, import CSV, tạo/gửi yêu cầu phân công, duyệt/từ chối phân công và thay thế, export CSV/XLSX |
| **Trưởng Khoa** | Phân công CVHT thủ công hoặc tự động (auto-assign), cập nhật độ ưu tiên CVHT, duyệt bước 1 yêu cầu thay thế |
| **CVHT** | Xem hồ sơ, lớp đang phụ trách, sinh viên trong lớp, gửi yêu cầu dừng cố vấn |
| **Sinh viên** | Xem profile và thông tin CVHT đang phụ trách lớp mình |
| **Thông báo** | Hệ thống thông báo theo role, mỗi role chỉ thấy thông báo đúng phạm vi |
| **Chat** | Nhắn tin real-time giữa Sinh viên và CVHT qua WebSocket (STOMP/SockJS) |
| **Dữ liệu** | Bảng dữ liệu hỗ trợ lọc cột, phân trang, export CSV/XLSX |

---

## Công Nghệ

| Thành phần | Công nghệ | Phiên bản |
|------------|-----------|-----------|
| **Frontend** | React, Vite, React Router DOM | 18.2 / 5.2 / 6.23 |
| **HTTP Client** | Axios | 1.6 |
| **WebSocket** | STOMP.js, SockJS | 7.3 / 1.6 |
| **Excel Export** | SheetJS (xlsx) | 0.18 |
| **Backend nghiệp vụ** | Node.js, Express | 20 / 4.19 |
| **ORM / DB Driver** | mysql2/promise | 3.9 |
| **Auth utils (Node)** | jsonwebtoken, bcryptjs | 9 / 2.4 |
| **File upload** | Multer | 1.4 |
| **Email (Node)** | Nodemailer | 8.0 |
| **CSV parse** | csv-parse | 5.5 |
| **Backend xác thực** | Spring Boot, Spring Security Crypto | 4.0.1 / Java 21 |
| **JWT (Spring)** | Nimbus JOSE JWT | 10.6 |
| **WebSocket (Spring)** | spring-boot-starter-websocket | — |
| **Cache** | Spring Data Redis | — |
| **Database** | MySQL | 8.0 |
| **Local services** | Docker Compose, Redis, phpMyAdmin | — |

### Routing API

Frontend chia API call theo mục đích:

- Các request `/auth/*` → **Spring Boot** (`VITE_SPRING_BOOT_API_URL`, mặc định `http://localhost:8080/api`)
- Các request nghiệp vụ khác → **Node.js** (`VITE_API_URL`, mặc định `http://localhost:5000/api`)

> Node.js cũng có module auth tương đương nhưng frontend hiện ưu tiên Spring Boot cho nhóm API xác thực.

---

## Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (React 18)                         │
│  Login/OAuth → Spring Boot Auth API (:8080)                         │
│  Business API → Node.js Express API (:5000)                         │
│  WebSocket (Chat) → Spring Boot WebSocket (:8080/ws)                │
└────────────┬────────────────┬───────────────────────────────────────┘
             │                │
     ┌───────▼──────┐  ┌──────▼──────────────────────┐
     │  Node.js     │  │  Spring Boot                  │
     │  Express     │  │  Auth / OAuth / OTP / Chat    │
     │  :5000       │  │  :8080                        │
     └───────┬──────┘  └──────┬──────────────┬─────────┘
             │                │              │
             └────────┬───────┘              │
                      │                      │
              ┌───────▼──────┐      ┌────────▼────────┐
              │   MySQL 8    │      │   Redis 7        │
              │   :3306      │      │   :6379          │
              └──────────────┘      └─────────────────┘
```

---

## Cấu Trúc Dự Án

```
adivisor/
├── .env                          # Biến môi trường (không commit)
├── .env.example                  # Template biến môi trường
├── .gitignore
├── docker-compose.yml            # Orchestration toàn bộ services
├── package.json                  # Root workspace (nếu có)
├── AI-Agent                      # Tài liệu kỹ thuật chi tiết cho AI
├── README.md
│
├── Backend/                      # Node.js + Express (nghiệp vụ chính)
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── app.js                # Cấu hình Express, mount routes
│       ├── server.js             # Entry point
│       ├── config/
│       │   ├── db.js             # MySQL pool, query(), transaction()
│       │   └── env.js            # Load .env, export cấu hình
│       ├── database/
│       │   ├── schema.sql        # DDL tất cả bảng
│       │   ├── seed.sql          # Dữ liệu khoa mẫu
│       │   └── init-db.js        # Khởi tạo DB, chạy schema + seed
│       ├── middlewares/
│       │   ├── auth.js           # authenticate, requireRole, requirePasswordChanged
│       │   └── errorHandler.js   # Global error handler
│       ├── modules/
│       │   ├── auth/             # Đăng nhập, token, OTP, đổi mật khẩu
│       │   ├── admin/            # Quản lý tài khoản nhân viên, import CSV
│       │   ├── ctsv/             # Lớp, sinh viên, phân công, thay thế
│       │   ├── khoa/             # Phân công CVHT, ưu tiên, thay thế bước 1
│       │   ├── covan/            # Xem lớp, sinh viên, gửi yêu cầu dừng
│       │   ├── sinhvien/         # Xem profile, xem CVHT
│       │   └── notifications/    # Đọc và tạo thông báo
│       └── utils/
│           ├── asyncHandler.js   # Wrap async route handler
│           ├── httpError.js      # HttpError, notFound, badRequest, forbidden
│           ├── ids.js            # makeId(prefix): tạo mã ngẫu nhiên
│           ├── passwords.js      # bcrypt hash/verify, mật khẩu mặc định theo role
│           ├── csv.js            # Parse CSV buffer UTF-8
│           └── stateMachine.js   # Constants và allowed transitions
│
├── BackendSpringBoot/            # Spring Boot (Auth / WebSocket / OAuth2)
│   ├── Dockerfile
│   ├── pom.xml                   # Maven: Spring Boot 4.0.1, Java 21
│   ├── mvnw / mvnw.cmd
│   └── src/main/java/com/example/backendspringboot/
│       ├── BackendSpringBootApplication.java
│       ├── configuration/        # SecurityConfig, WebSocketConfig, CORS
│       ├── controller/           # AuthController, ChatController
│       ├── dto/                  # Request/Response DTOs
│       ├── entity/               # Account, RefreshToken, LoginAttempt, ...
│       ├── enums/                # AccountType, ErrorCode
│       ├── exception/            # GlobalExceptionHandler, AppException
│       ├── mapper/               # AccountMapper (load profile theo role)
│       ├── repository/           # JPA repositories
│       ├── service/              # AuthenticationService, JwtService, OtpService, ...
│       ├── util/                 # Cookie utility, SHA256 helper
│       └── validator/            # Custom validation annotations
│
└── Frontend/                     # React 18 + Vite
    ├── Dockerfile
    ├── .env.example
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── public/
    │   ├── bg-login.jpg          # Ảnh nền trang đăng nhập
    │   └── ptit-logo.png         # Logo watermark dashboard
    └── src/
        ├── main.jsx              # Entry: BrowserRouter + AuthProvider
        ├── App.jsx               # Route configuration
        ├── api/
        │   ├── client.js         # Axios instance + interceptor tự động refresh
        │   └── chatSocket.js     # STOMP/SockJS WebSocket helper
        ├── context/
        │   └── AuthContext.jsx   # Auth state, login/logout/refresh
        ├── components/
        │   ├── AppLayout.jsx     # Sidebar layout chung
        │   ├── DataTable.jsx     # Bảng có lọc, phân trang, export
        │   ├── ProtectedRoute.jsx
        │   ├── Toast.jsx
        │   └── ExpandableText.jsx
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── ChangePasswordPage.jsx
        │   ├── ForgotPasswordPage.jsx
        │   ├── AdminDashboard.jsx
        │   ├── CtsvDashboard.jsx
        │   ├── KhoaDashboard.jsx
        │   ├── CovanDashboard.jsx
        │   ├── SinhVienDashboard.jsx
        │   ├── ChatPage.jsx
        │   └── NotificationsPage.jsx
        └── styles/
            └── main.css          # Global stylesheet
```

---

## Cài Đặt Và Khởi Chạy

### Yêu Cầu

| Công cụ | Phiên bản tối thiểu | Ghi chú |
|---------|---------------------|---------|
| Docker Desktop | Bất kỳ | Bắt buộc khi chạy Docker |
| Docker Compose | v2+ | Tích hợp trong Docker Desktop |
| Node.js | 18+ | Chỉ cần khi chạy thủ công |
| Java JDK | 21 | Chỉ cần khi chạy thủ công Spring Boot |
| MySQL | 8.0 | Chỉ cần khi không dùng Docker |

### Cổng Mặc Định

| Dịch vụ | Cổng | URL |
|---------|------|-----|
| Frontend (React/Vite) | `5173` | http://localhost:5173 |
| Backend Node.js | `5000` | http://localhost:5000/api |
| Backend Spring Boot | `8080` | http://localhost:8080/api |
| MySQL | `3306` | — |
| Redis | `6379` | — |
| phpMyAdmin | `8081` | http://localhost:8081 |

---

### Cách 1: Chạy Bằng Docker Compose (Khuyến Nghị)

**Bước 1:** Sao chép và chỉnh sửa file cấu hình môi trường:

```bash
cp .env.example .env
# Chỉnh sửa .env nếu cần (SMTP, OAuth2, ...)
```

**Bước 2:** Khởi chạy toàn bộ hệ thống:

```bash
docker compose up -d --build
```

Docker sẽ tự động:
1. Khởi chạy MySQL, Redis, phpMyAdmin
2. Node backend chạy `npm run db:init` (tạo schema + seed dữ liệu mẫu) rồi `npm run dev`
3. Spring Boot backend biên dịch và khởi chạy
4. Frontend chạy dev server

**Bước 3:** Kiểm tra trạng thái:

```bash
docker compose ps
```

**Các lệnh hữu ích:**

```bash
# Xem log từng service
docker compose logs -f backend
docker compose logs -f backend-springboot
docker compose logs -f frontend
docker compose logs -f mysql

# Dừng tất cả
docker compose down

# Dừng và xóa toàn bộ dữ liệu (reset sạch DB)
docker compose down -v
docker compose up -d --build
```

---

### Cách 2: Chạy Thủ Công (Development)

**Bước 1:** Khởi chạy MySQL và Redis bằng Docker:

```bash
docker compose up -d mysql redis
```

**Bước 2:** Khởi tạo database và chạy Backend Node:

```bash
cd Backend
npm install
npm run db:init      # Tạo DB, chạy schema.sql, seed.sql, thêm dữ liệu mẫu
npm run dev          # Nodemon dev server tại :5000
```

**Bước 3:** Chạy Spring Boot:

```bash
cd BackendSpringBoot
.\mvnw.cmd spring-boot:run    # Windows
./mvnw spring-boot:run        # Linux/macOS
```

**Bước 4:** Chạy Frontend:

```bash
cd Frontend
npm install
npm run dev          # Vite dev server tại :5173
```

---

## Cấu Hình Môi Trường

Sao chép `.env.example` thành `.env` ở thư mục gốc. Docker Compose sẽ tự đọc file này.

### Biến Môi Trường Quan Trọng

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `NODE_ENV` | `development` | Môi trường Node.js |
| `PORT` | `5000` | Cổng Node API |
| `FRONTEND_URL` | `http://localhost:5173` | Origin frontend được phép CORS |
| **Database** | | |
| `DB_HOST` | `localhost` / `mysql` (Docker) | Host MySQL |
| `DB_PORT` | `3306` | Cổng MySQL |
| `DB_NAME` | `adivisor` | Tên database |
| `DB_USER` | `adivisor` | User database |
| `DB_PASSWORD` | `adivisor_password` | Mật khẩu database |
| `DB_ROOT_PASSWORD` | `root_password` | Mật khẩu root MySQL |
| **JWT** | | |
| `JWT_SECRET` | `adivisor_dev_secret_change_me` | Secret ký access token (Node) |
| `JWT_REFRESH_SECRET` | `dev_refresh_secret_change_me` | Secret ký refresh token |
| `JWT_EXPIRES_IN` | `8h` | Thời gian sống access token Node |
| `JWT_ACCESS_EXPIRES_SECONDS` | `28800` | Access token expiry (Spring Boot, giây) |
| `JWT_REFRESH_EXPIRES_SECONDS` | `604800` | Refresh token expiry (Spring Boot, giây) |
| **OTP & Reset** | | |
| `PASSWORD_RESET_EXPIRES_IN` | `15m` | Thời gian sống reset token |
| `PASSWORD_RESET_OTP_EXPIRES_IN` | `5m` | Thời gian sống OTP |
| `OTP_EXPIRES_SECONDS` | `300` | OTP expiry (Spring Boot, giây) |
| **Email SMTP** | | |
| `SMTP_HOST` | `smtp.gmail.com` | Host SMTP |
| `SMTP_PORT` | `587` | Cổng SMTP |
| `SMTP_SECURE` | `false` | TLS/SSL |
| `SMTP_USER` | — | Tài khoản email |
| `SMTP_PASSWORD` | — | Mật khẩu email / App Password |
| `SMTP_FROM` | — | Địa chỉ gửi |
| **Google OAuth2** | | |
| `GG_CLIENT_ID` | — | Google Client ID |
| `GG_CLIENT_SECRET` | — | Google Client Secret |
| `GG_REDIRECT_URI` | `http://localhost:8080/api/auth/google/callback` | Redirect URI |
| **Frontend** | | |
| `VITE_API_URL` | `http://localhost:5000/api` | URL Node API (nghiệp vụ) |
| `VITE_SPRING_BOOT_API_URL` | `http://localhost:8080/api` | URL Spring Boot API (xác thực) |
| **phpMyAdmin** | | |
| `PHPMYADMIN_PORT` | `8081` | Cổng phpMyAdmin |
| `COOKIE_SECURE` | `false` | Bật HTTPS cookie (production) |

> **Lưu ý bảo mật:** Khi triển khai production, bắt buộc thay đổi tất cả secret/password, bật `COOKIE_SECURE=true`, cấu hình SMTP và OAuth2 thật.

---

## Tài Khoản Mẫu

Dữ liệu mẫu được tự động tạo khi chạy `npm run db:init` hoặc khởi động Docker.

| Vai trò | Tên đăng nhập | Mật khẩu mặc định |
|---------|--------------|-------------------|
| Admin | `admin` | `admin` |
| CTSV | `CTSV01` | `ctsv` |
| Trưởng Khoa CNTT | `TKCNTT01` | `cntt02` |
| CVHT | `CVHT01` | `cvht` |
| Sinh viên | `SV001` | `0900000001` |

> Sau lần đăng nhập đầu tiên, hệ thống **bắt buộc** đổi mật khẩu. Khi đổi thành công, cờ `TAI_KHOAN.da_doi_mk = true` sẽ được cập nhật.

### Dữ Liệu Mẫu Kèm Theo

- **4 Khoa:** CNTT (Công nghệ thông tin), VT (Viễn thông), QTKD (Quản trị kinh doanh), KTDT (Kỹ thuật điện tử)
- **Lớp mẫu:** `D21CQCN01`, khoa CNTT, năm học `2026-2027`, chưa có CVHT, 1 sinh viên

---

## Database Schema

### Sơ Đồ Quan Hệ

```
TAI_KHOAN (1) ────── (1) QUAN_TRI_VIEN
TAI_KHOAN (1) ────── (1) NHAN_VIEN_CTSV
TAI_KHOAN (1) ────── (1) TRUONG_KHOA
TAI_KHOAN (1) ────── (0..1) CVHT
TAI_KHOAN (1) ────── (1) SINH_VIEN

KHOA (1) ──────────── (N) TRUONG_KHOA
KHOA (1) ──────────── (N) CVHT
KHOA (1) ──────────── (N) LOP

LOP (1) ────────────── (N) SINH_VIEN
LOP (1) ────────────── (N) PHAN_CONG
LOP (1) ────────────── (N) HOI_THOAI

CVHT (1) ───────────── (N) LOP (ma_co_van)
CVHT (1) ───────────── (N) PHAN_CONG (ma_co_van)
CVHT (1) ───────────── (N) YEU_CAU_THAY_THE (ma_co_van - cũ)

PHAN_CONG (1) ──────── (0..1) YEU_CAU_THAY_THE

THONG_BAO (1) ──────── (N) THONG_BAO_NGUOI_NHAN
NHAN_VIEN_CTSV (1) ─── (N) THONG_BAO

TAI_KHOAN (1) ──────── (N) REFRESH_TOKENS
HOI_THOAI (1) ──────── (N) TIN_NHAN
SINH_VIEN (1) ──────── (N) HOI_THOAI
CVHT (1) ───────────── (N) HOI_THOAI
```

### Mô Tả Các Bảng Chính

| Bảng | Mô tả |
|------|-------|
| `TAI_KHOAN` | Tài khoản đăng nhập: username, password (bcrypt), email, role, `da_doi_mk`, `is_active` |
| `QUAN_TRI_VIEN` | Profile Admin |
| `NHAN_VIEN_CTSV` | Profile nhân viên Phòng CTSV |
| `KHOA` | Danh sách khoa |
| `TRUONG_KHOA` | Profile Trưởng Khoa, liên kết khoa |
| `CVHT` | Profile Cố vấn học tập: khoa, chuyên ngành, `uu_tien` (1–3), có thể không có tài khoản |
| `SINH_VIEN` | Profile sinh viên, liên kết lớp |
| `LOP` | Lớp học: khoa, chuyên ngành, năm học, `ma_co_van`, `trang_thai_lop`, số lượng sinh viên |
| `PHAN_CONG` | Bản ghi phân công CVHT cho lớp: trạng thái, năm học, tên Trưởng Khoa |
| `YEU_CAU_THAY_THE` | Yêu cầu thay thế CVHT: lý do, trạng thái, ngày yêu cầu |
| `THONG_BAO` | Thông báo: tiêu đề, nội dung, ngày gửi |
| `THONG_BAO_NGUOI_NHAN` | Người nhận thông báo: loại (ctsv/khoa/covan/lop), mã đối tượng |
| `DANG_NHAP_THAT_BAI` | Đếm số lần đăng nhập thất bại theo username + ngày |
| `REFRESH_TOKENS` | JWT refresh token lưu trong DB |
| `HOI_THOAI` | Hội thoại chat giữa sinh viên và CVHT |
| `TIN_NHAN` | Tin nhắn trong hội thoại, đánh dấu đã đọc |

---

## Vai Trò Và Chức Năng

### Admin

- Xem danh sách nhóm nhân viên theo khoa (Trưởng Khoa, CVHT, CTSV)
- Xem và chỉnh sửa tài khoản nhân viên (Trưởng Khoa, CTSV)
- Khóa/mở khóa tài khoản nhân viên
- Xem và chỉnh sửa thông tin CVHT (hồ sơ, không chỉnh `uu_tien` tại đây)
- Xóa CVHT (tự động hủy liên kết tài khoản, xóa yêu cầu liên quan)
- Import hàng loạt qua CSV: Trưởng Khoa, CTSV, thông tin CVHT, tài khoản CVHT, CVHT đầy đủ

### CTSV (Phòng Công Tác Sinh Viên)

- CRUD lớp học (chỉ xóa/sửa khi không có sinh viên)
- Import lớp bằng CSV
- CRUD sinh viên và tài khoản sinh viên
- Import sinh viên bằng CSV
- Gửi yêu cầu phân công CVHT cho tất cả khoa
- Xem và duyệt/từ chối phân công (bước cuối)
- Duyệt/từ chối tất cả phân công (bulk)
- Xem và duyệt/từ chối thay thế CVHT (bước cuối)
- Export danh sách phân công/thay thế ra CSV hoặc XLSX

### Trưởng Khoa

- Xem yêu cầu phân công của khoa mình
- Chọn CVHT thủ công cho từng lớp
- Auto-assign CVHT (ưu tiên cùng chuyên ngành, `uu_tien` thấp, còn chỗ)
- Gửi danh sách phân công lên CTSV/Giám đốc
- Cập nhật độ ưu tiên (`uu_tien` 1–3) của CVHT trong khoa
- Duyệt bước 1 yêu cầu thay thế (chọn CVHT mới)
- Từ chối yêu cầu thay thế bước 1
- Xem lịch sử phân công và thay thế

### CVHT (Cố Vấn Học Tập)

- Xem hồ sơ cá nhân
- Xem danh sách lớp đang phụ trách
- Xem sinh viên của từng lớp
- Gửi yêu cầu dừng cố vấn (kèm lý do)
- Xem lịch sử yêu cầu đã gửi
- Chat với sinh viên (real-time WebSocket)

### Sinh Viên

- Xem profile cá nhân (lớp, khoa, chuyên ngành)
- Xem thông tin CVHT đang phụ trách lớp
- Chat với CVHT (real-time WebSocket)

---

## Luồng Nghiệp Vụ

### Phân Công CVHT

```
CTSV tạo lớp + sinh viên
        ↓
CTSV → "Gửi yêu cầu" → PHAN_CONG tạo cho lớp đủ điều kiện
        ↓                (có sinh viên, chưa có CVHT, chưa có request active)
Trưởng Khoa nhận yêu cầu
        ↓
Khoa chọn CVHT (thủ công/auto) → PHAN_CONG "Đã phân công"
        ↓
Khoa gửi lên CTSV → PHAN_CONG "Chờ giám đốc duyệt" + thông báo CTSV
        ↓
    ┌───┴───┐
CTSV Duyệt  CTSV Từ chối
    ↓           ↓
LOP.ma_co_van   PHAN_CONG → "Chờ phân công"
PHAN_CONG "Đã đóng"    Xóa advisor, thông báo Khoa
Thông báo lớp/khoa/CVHT
```

**Điều kiện auto-assign:**
- CVHT thuộc đúng khoa
- `uu_tien != 3`
- Có tài khoản và tài khoản đang hoạt động
- Số lớp đang phụ trách < 2
- Ưu tiên: `uu_tien` nhỏ → ít lớp hơn → cùng chuyên ngành → tên

### Thay Thế CVHT

```
CVHT chọn lớp + nhập lý do → "Gửi yêu cầu dừng cố vấn"
        ↓
Backend tạo PHAN_CONG mới (không có CVHT, "Chờ phân công")
         + YEU_CAU_THAY_THE "Chờ duyệt"
        ↓
Khoa nhận thông báo
        ↓
Khoa chọn CVHT mới, duyệt bước 1
        ↓
PHAN_CONG new advisor "Đã phân công" + YEU_CAU "Khoa đã duyệt"
Thông báo CTSV và CVHT cũ
        ↓
    ┌───┴───┐
CTSV Duyệt  CTSV Từ chối
    ↓           ↓
LOP.ma_co_van=new    YEU_CAU "Bị từ chối"
PHAN_CONG "Đã đóng"  Thông báo Khoa + CVHT cũ
YEU_CAU "Đã đóng"
Thông báo lớp/khoa/CVHT cũ/CVHT mới
```

**Duplicate check:** Chặn gửi yêu cầu mới khi còn request active (Chờ duyệt / Khoa đang duyệt / Khoa đã duyệt / Giám đốc đang duyệt). Request đã đóng/bị từ chối không chặn.

---

## State Machine

File `Backend/src/utils/stateMachine.js` là **nguồn sự thật duy nhất** cho tất cả trạng thái.

### Trạng Thái Lớp (`LOP.trang_thai_lop`)

| Hằng số | Giá trị | Ý nghĩa |
|---------|---------|---------|
| `CHUA_CO_CVHT` | `Chưa có cố vấn` | Có sinh viên nhưng chưa được phân công |
| `LOP_TRONG` | `Lớp trống` | Không có sinh viên |
| `CHO_PHAN_CONG` | `Chờ phân công` | Đã gửi yêu cầu, đang chờ Khoa xử lý |
| `DANG_PHAN_CONG` | `Đang phân công` | Khoa đang chọn CVHT |
| `DA_CO_CVHT` | `Đã có cố vấn` | Đã được phân công CVHT |
| `DA_DONG` | `Đã đóng` | Phân công hoàn tất |
| `BI_TU_CHOI` | `Bị từ chối` | Phân công bị từ chối |

### Trạng Thái Phân Công (`PHAN_CONG.trang_thai`)

```
Chờ phân công → Đã phân công → Chờ giám đốc duyệt → Đã đóng
                      ↑                    ↓
                      └────────────────────┘ (từ chối → quay về Chờ phân công)
```

### Trạng Thái Yêu Cầu Thay Thế (`YEU_CAU_THAY_THE.trang_thai`)

```
Chờ duyệt
    ↓
Khoa đang duyệt → Bị từ chối
    ↓
Khoa đã duyệt → Bị từ chối
    ↓
Giám đốc đang duyệt → Bị từ chối
    ↓
Giám đốc đã duyệt
    ↓
Đã đóng
```

---

## Import Và Export

### Import CSV

Tất cả import đều sử dụng `multipart/form-data` với field tên `file`.

#### Admin Import

| Endpoint | Cột CSV cần có | Ghi chú |
|----------|---------------|---------|
| `POST /api/admin/faculty-heads/import` | Mã nhân viên, Họ và tên, Email, Khoa | Khoa phải khớp `ten_khoa` đầy đủ |
| `POST /api/admin/ctsv/import` | Mã nhân viên, Họ và tên, Email | — |
| `POST /api/admin/advisors/info/import` | Mã nhân viên, Họ và tên, Số điện thoại, Khoa, Chuyên ngành, Ưu tiên | Tạo CVHT không có tài khoản |
| `POST /api/admin/advisors/accounts/import` | Mã nhân viên, Email | CVHT phải tồn tại và chưa có tài khoản |
| `POST /api/admin/advisors/full/import` | Mã nhân viên, Họ và tên, Số điện thoại, Email, Khoa, Chuyên ngành, Ưu tiên | Tạo/cập nhật CVHT và tài khoản |

#### CTSV Import

| Endpoint | Cột CSV cần có |
|----------|---------------|
| `POST /api/ctsv/classes/import` | Mã lớp, Tên lớp, Mã khoa, Chuyên ngành |
| `POST /api/ctsv/students/import` | Mã sinh viên, Họ và tên, Email, Số điện thoại, Mã lớp |

> **Mật khẩu mặc định khi import:**
> - Sinh viên: số điện thoại
> - CTSV: `ctsv`
> - CVHT: `cvht`
> - Trưởng Khoa: `cntt02` / `vt02` / `qtkd02` / `ktdt02` tùy khoa

### Export

CTSV có thể xuất dữ liệu phân công và yêu cầu thay thế ra:
- **CSV** (`.csv`): định dạng thuần văn bản
- **Excel** (`.xlsx`): sử dụng thư viện SheetJS

| Loại export | Điều kiện | Tên file |
|-------------|-----------|---------|
| Phân công chờ giám đốc | Có assignment trạng thái `Chờ giám đốc duyệt` | `phan-cong-cho-giam-doc-duyet` |
| Kết quả phân công | Tất cả lớp đã có CVHT (đóng) | `ket-qua-phan-cong` |
| Yêu cầu thay thế | Trạng thái `Khoa đã duyệt` / `Giám đốc đang duyệt` | `danh-sach-yeu-cau-thay-the` |

---

## API Reference

### Authentication (Spring Boot — `:8080/api/auth`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/login` | Đăng nhập, set cookie |
| `POST` | `/logout` | Đăng xuất, xóa cookie |
| `POST` | `/refresh-token` | Làm mới access token |
| `GET` | `/me` | Thông tin user hiện tại |
| `POST` | `/change-password` | Đổi mật khẩu |
| `POST` | `/forgot-password` | Gửi OTP về email |
| `POST` | `/verify-reset-otp` | Xác nhận OTP |
| `POST` | `/reset-password` | Đặt lại mật khẩu |
| `GET` | `/google/login` | Lấy URL đăng nhập Google |
| `GET` | `/google/callback` | Callback OAuth2 Google |

### Admin (Node — `:5000/api/admin`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/faculties` | Danh sách khoa |
| `GET` | `/employee-groups` | Nhóm nhân viên theo khoa |
| `GET` | `/employee-groups/:id/accounts` | Tài khoản trong nhóm |
| `PATCH` | `/employee-accounts/:id` | Chỉnh sửa tài khoản nhân viên |
| `DELETE` | `/employee-accounts/:id` | Xóa tài khoản nhân viên |
| `GET` | `/faculties/:id/employees` | Nhân viên theo khoa |
| `GET` | `/advisors/info` | Danh sách thông tin CVHT |
| `GET` | `/advisor-groups/:id/advisors` | CVHT theo nhóm khoa |
| `PATCH` | `/advisors/info/:id` | Cập nhật thông tin CVHT |
| `DELETE` | `/advisors/info/:id` | Xóa CVHT |
| `GET` | `/accounts` | Tất cả tài khoản |
| `PATCH` | `/accounts/:id/status` | Khóa/mở khóa tài khoản |
| `POST` | `/faculty-heads/import` | Import Trưởng Khoa CSV |
| `POST` | `/ctsv/import` | Import CTSV CSV |
| `POST` | `/advisors/info/import` | Import thông tin CVHT CSV |
| `POST` | `/advisors/accounts/import` | Import tài khoản CVHT CSV |
| `POST` | `/advisors/full/import` | Import CVHT đầy đủ CSV |

### CTSV (Node — `:5000/api/ctsv`)

**Sinh viên:**

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/students` | Danh sách sinh viên |
| `POST` | `/students` | Thêm sinh viên |
| `POST` | `/students/import` | Import sinh viên CSV |
| `PATCH` | `/students/:id` | Cập nhật sinh viên |
| `PATCH` | `/students/:id/account-status` | Khóa/mở khóa tài khoản SV |
| `DELETE` | `/students/:id` | Xóa sinh viên |

**Lớp học:**

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/class-groups` | Nhóm lớp theo khoa |
| `GET` | `/classes` | Danh sách lớp |
| `POST` | `/classes` | Thêm lớp |
| `POST` | `/classes/import` | Import lớp CSV |
| `POST` | `/classes/reset-advisors` | Reset phân công (làm mới) |
| `POST` | `/classes/send-to-faculties` | Gửi yêu cầu phân công |
| `PATCH` | `/classes/:id` | Cập nhật lớp |
| `DELETE` | `/classes/:id` | Xóa lớp |
| `DELETE` | `/classes/:id/students` | Xóa tất cả sinh viên của lớp |

**Phân công:**

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/assignments` | Danh sách phân công |
| `POST` | `/assignments` | Tạo yêu cầu phân công đơn |
| `POST` | `/assignments/approve-all` | Duyệt tất cả |
| `POST` | `/assignments/reject-all` | Từ chối tất cả |
| `POST` | `/assignments/:id/send` | Gửi yêu cầu đơn |
| `POST` | `/assignments/:id/approve` | Duyệt phân công đơn |
| `POST` | `/assignments/:id/reject` | Từ chối phân công đơn |

**Thay thế:**

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/replacement-requests` | Danh sách yêu cầu thay thế |
| `POST` | `/replacement-requests/approve-all` | Duyệt tất cả thay thế |
| `POST` | `/replacement-requests/reject-all` | Từ chối tất cả thay thế |
| `POST` | `/replacement-requests/:id/approve` | Duyệt thay thế đơn |
| `POST` | `/replacement-requests/:id/reject` | Từ chối thay thế đơn |

### Trưởng Khoa (Node — `:5000/api/khoa`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/assignments` | Yêu cầu phân công của khoa |
| `GET` | `/advisors` | Danh sách CVHT trong khoa |
| `PATCH` | `/advisors/:id/priority` | Cập nhật ưu tiên CVHT |
| `POST` | `/assignments/auto-assign` | Tự động phân công |
| `POST` | `/assignments/submit-all` | Gửi tất cả phân công lên CTSV |
| `POST` | `/assignments/:id/assign` | Chọn CVHT cho phân công đơn |
| `POST` | `/assignments/:id/submit` | Gửi phân công đơn lên CTSV |
| `GET` | `/replacement-requests` | Yêu cầu thay thế của khoa |
| `POST` | `/replacement-requests/:id/approve-step-1` | Duyệt bước 1 + chọn CVHT mới |
| `POST` | `/replacement-requests/:id/reject-step-1` | Từ chối bước 1 |

### CVHT (Node — `:5000/api/covan`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/me` | Hồ sơ CVHT |
| `GET` | `/classes` | Lớp đang phụ trách |
| `GET` | `/classes/:id/students` | Sinh viên của lớp |
| `GET` | `/replacement-requests` | Lịch sử yêu cầu đã gửi |
| `POST` | `/replacement-requests` | Gửi yêu cầu dừng cố vấn |

### Sinh Viên (Node — `:5000/api/sinhvien`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/me` | Hồ sơ sinh viên |
| `GET` | `/advisor` | Thông tin CVHT của lớp |

### Thông Báo (Node — `:5000/api/notifications`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/` | Danh sách thông báo (theo scope role) |
| `POST` | `/` | Tạo thông báo thủ công (chỉ CTSV) |

### Health Check

```
GET http://localhost:5000/api/health
→ { "status": "ok", "service": "adivisor-backend" }
```

---

## Quy Tắc Phân Quyền

| Nguyên tắc | Chi tiết |
|------------|---------|
| **Bắt buộc xác thực** | Mọi API nghiệp vụ yêu cầu cookie `accessToken` hợp lệ |
| **Bắt buộc đổi mật khẩu** | Tài khoản chưa đổi mật khẩu (`da_doi_mk=false`) nhận HTTP 428 |
| **Kiểm tra role** | `loai_tai_khoan` trong JWT xác định quyền truy cập |
| **Admin** | Quản lý tài khoản/dữ liệu CVHT; không tự khóa/xóa tài khoản admin hoặc covan |
| **CTSV** | Quyền tổng hợp toàn hệ thống; duyệt cuối phân công và thay thế |
| **Trưởng Khoa** | Chỉ thao tác dữ liệu thuộc `ma_khoa` của mình |
| **CVHT** | Chỉ xem lớp mình phụ trách và sinh viên của lớp đó |
| **Sinh viên** | Chỉ xem thông tin lớp và CVHT của chính mình |
| **Thông báo** | Mỗi role chỉ nhận thông báo đúng scope; không rò rỉ thông báo ngoài phạm vi |
| **Capacity CVHT** | Mỗi CVHT tối đa 2 lớp phụ trách đồng thời |

---

## Hệ Thống Thông Báo

Thông báo lưu trong hai bảng: `THONG_BAO` (nội dung) và `THONG_BAO_NGUOI_NHAN` (đối tượng nhận).

### Scope Nhận Thông Báo

| Role | Điều kiện lọc |
|------|--------------|
| Admin | Xem tất cả |
| CTSV | `loai_nguoi_nhan='ctsv' AND ma_doi_tuong='ALL'` |
| Trưởng Khoa | `loai_nguoi_nhan='khoa' AND ma_doi_tuong=ma_khoa` |
| CVHT | `loai_nguoi_nhan='covan' AND ma_doi_tuong=ma_co_van` |
| Sinh viên | `loai_nguoi_nhan='lop' AND ma_doi_tuong=ma_lop` |

### Cơ Chế Unread

Frontend sử dụng localStorage để theo dõi thông báo đã đọc, kiểm tra mỗi 15 giây:
- `read_notification_ids:{ma_tai_khoan}` — ID thông báo đã đọc
- `seen_khoa_assignments` / `seen_khoa_replacements` — Khoa đã xem
- `seen_ctsv_assignments` / `seen_ctsv_replacements` — CTSV đã xem
- `seen_khoa_assignment_details` — Chi tiết phân công Khoa đã xem

---

## Kiểm Thử

### Kiểm Tra Cú Pháp Backend Node

```bash
node --check Backend/src/modules/auth/auth.service.js
node --check Backend/src/modules/admin/admin.service.js
node --check Backend/src/modules/ctsv/ctsv.service.js
node --check Backend/src/modules/khoa/khoa.service.js
node --check Backend/src/modules/covan/covan.service.js
node --check Backend/src/modules/sinhvien/sinhvien.service.js
node --check Backend/src/modules/notifications/notifications.service.js
```

### Build Frontend

```bash
cd Frontend
npm run build
```

### Test Spring Boot

```bash
cd BackendSpringBoot
.\mvnw.cmd test
```

### Kiểm Thử Thủ Công (Smoke Test)

1. **Admin:** Đăng nhập `admin/admin` → đổi mật khẩu → import CVHT/nhân viên qua CSV → kiểm tra bảng tài khoản
2. **CTSV:** Đăng nhập → import lớp và sinh viên → bấm "Gửi yêu cầu" phân công
3. **Trưởng Khoa:** Đăng nhập → xem yêu cầu phân công → Auto-assign hoặc chọn CVHT thủ công → Gửi lên CTSV
4. **CTSV:** Duyệt phân công → kiểm tra lớp có CVHT → kiểm tra thông báo đúng role
5. **CVHT:** Đăng nhập → xem lớp đang phụ trách → gửi yêu cầu dừng cố vấn → kiểm tra "Yêu cầu đã gửi"
6. **Trưởng Khoa:** Duyệt bước 1 + chọn CVHT mới
7. **CTSV:** Duyệt bước cuối → kiểm tra lịch sử thay thế ở các role → export CSV và XLSX
8. **Sinh viên:** Đăng nhập → kiểm tra thông tin CVHT được phân công
9. **Chat:** Sinh viên gửi tin nhắn cho CVHT, kiểm tra nhận real-time

---

## Xử Lý Sự Cố

### Frontend Không Đăng Nhập Được

Kiểm tra Spring Boot và Redis:

```bash
docker compose ps
docker compose logs -f backend-springboot
docker compose logs -f redis
```

Kiểm tra biến môi trường frontend:

```env
VITE_SPRING_BOOT_API_URL=http://localhost:8080/api
```

Nếu đang chạy thủ công, đảm bảo Spring Boot đã start thành công tại cổng 8080.

### Database Sai Hoặc Cần Reset Dữ Liệu Mẫu

Bằng Docker (reset hoàn toàn):

```bash
docker compose down -v
docker compose up -d --build
```

Bằng Node backend thủ công:

```bash
cd Backend
npm run db:init
```

### Không Gửi Được OTP Email

Kiểm tra cấu hình SMTP trong `.env`. Nếu dùng Gmail, cần tạo **App Password** (không dùng mật khẩu thường):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM=your_gmail@gmail.com
```

Cách tạo Gmail App Password: Tài khoản Google → Bảo mật → Xác minh 2 bước → Mật khẩu ứng dụng.

### Đăng Nhập Sai Quá Nhiều Lần (HTTP 429)

Hệ thống giới hạn **5 lần sai mật khẩu** mỗi ngày cho một tên tài khoản. Trong môi trường phát triển, có thể xóa bản ghi trong bảng `DANG_NHAP_THAT_BAI` để mở lại ngay:

```sql
DELETE FROM DANG_NHAP_THAT_BAI WHERE ten_tai_khoan = 'username_bi_khoa';
```

Hoặc qua phpMyAdmin tại http://localhost:8081.

### Port Đã Được Sử Dụng

```powershell
netstat -ano | findstr :5000
netstat -ano | findstr :5173
netstat -ano | findstr :8080
netstat -ano | findstr :3306
netstat -ano | findstr :6379
```

Tắt process đang chiếm cổng hoặc thay đổi cổng trong `.env`.

### Spring Boot Không Kết Nối Được Redis

Kiểm tra service Redis:

```bash
docker compose logs -f redis
```

Đảm bảo biến môi trường được set đúng trong Docker Compose:

```yaml
SPRING_DATA_REDIS_HOST: redis
SPRING_DATA_REDIS_PORT: 6379
```

---

## Ghi Chú Phát Triển

### Quy Tắc Bắt Buộc

- **Không tự ý đổi tên bảng/cột database** — ảnh hưởng cả Node và Spring Boot
- **Không thêm bảng mới** khi chưa có nhu cầu nghiệp vụ rõ ràng
- **Tất cả trạng thái** phải đi qua `Backend/src/utils/stateMachine.js` — không tự tạo chuỗi trạng thái mới
- **Mọi API mới** phải kiểm tra role và scope dữ liệu đúng quy tắc phân quyền

### Mật Khẩu Mặc Định Theo Role

| Role | Mật khẩu mặc định |
|------|-------------------|
| `sinhvien` | `so_dien_thoai` (số điện thoại) |
| `ctsv` | `ctsv` |
| `covan` | `cvht` |
| `admin` | `admin` |
| `khoa` CNTT | `cntt02` |
| `khoa` VT | `vt02` |
| `khoa` QTKD | `qtkd02` |
| `khoa` KTDT | `ktdt02` |

### ID Generation

Hàm `makeId(prefix)` trong `utils/ids.js`:
```
prefix + Date.now().toString(36).toUpperCase() + 5_random_chars_uppercase
```

### Lưu Ý Kỹ Thuật

- **Spring Security** hiện cấu hình `permitAll()` cho toàn bộ; auth được kiểm tra ở tầng service thông qua cookie/token, không qua Spring filter chain
- **Spring CORS** hardcode `http://localhost:5173`; Node dùng biến `FRONTEND_URL`
- **Cookie** Node backend: `accessToken` maxAge hardcode 15 phút (dù `JWT_EXPIRES_IN=8h`); Spring Boot: access 8h, refresh 7 ngày
- **Frontend AppLayout** sử dụng inline CSS bổ sung cho `main.css` — không nên override mà tái cấu trúc vào stylesheet
- **Source code** có nhiều chuỗi tiếng Việt UTF-8; không tự ý encode/decode làm sai trạng thái
- **Redis** hiện được Spring Boot kết nối nhưng refresh token chủ yếu lưu trong MySQL (`REFRESH_TOKENS`)

### Checklist Triển Khai Production

- [ ] Đổi `JWT_SECRET` và `JWT_REFRESH_SECRET` thành giá trị mạnh, ngẫu nhiên
- [ ] Đổi mật khẩu database (`DB_PASSWORD`, `DB_ROOT_PASSWORD`)
- [ ] Cấu hình `SMTP_*` với email thật
- [ ] Cấu hình `GG_CLIENT_ID` và `GG_CLIENT_SECRET` nếu dùng Google OAuth2
- [ ] Đặt `COOKIE_SECURE=true` (HTTPS)
- [ ] Cập nhật `FRONTEND_URL` và Spring CORS origin thành domain thật
- [ ] Đặt `NODE_ENV=production`
- [ ] Xem xét bật Spring Security filter chain thay vì `permitAll()`
- [ ] Thiết lập backup database định kỳ
