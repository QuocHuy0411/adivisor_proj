# Adivisor

Hệ thống web quản lý và phân công Cố vấn học tập (CVHT) cho lớp sinh viên.

Adivisor hỗ trợ quy trình làm việc giữa Admin, Phòng Công tác Sinh viên (CTSV), Trưởng Khoa, CVHT và Sinh viên: quản lý tài khoản, import dữ liệu, lập danh sách lớp cần cố vấn, phân công CVHT, xử lý yêu cầu thay thế CVHT và gửi thông báo theo đúng phạm vi từng vai trò.

## Mục Lục

- [Tổng Quan](#tổng-quan)
- [Công Nghệ](#công-nghệ)
- [Cấu Trúc Dự Án](#cấu-trúc-dự-án)
- [Cài Đặt Và Khởi Chạy](#cài-đặt-và-khởi-chạy)
- [Tài Khoản Mẫu](#tài-khoản-mẫu)
- [Vai Trò Và Chức Năng](#vai-trò-và-chức-năng)
- [Luồng Nghiệp Vụ](#luồng-nghiệp-vụ)
- [Import Và Export](#import-và-export)
- [API Chính](#api-chính)
- [Quy Tắc Phân Quyền](#quy-tắc-phân-quyền)
- [Kiểm Thử](#kiểm-thử)
- [Xử Lý Sự Cố](#xử-lý-sự-cố)

## Tổng Quan

Hệ thống hiện có các nhóm chức năng chính:

- Xác thực đăng nhập, đăng xuất, JWT session, refresh token.
- Đổi mật khẩu lần đầu bằng trường `TAI_KHOAN.da_doi_mk`.
- Quên mật khẩu bằng OTP gửi email và reset mật khẩu.
- Chặn brute-force đăng nhập bằng bảng `DANG_NHAP_THAT_BAI`.
- Admin quản lý tài khoản nhân viên, thông tin CVHT và import CSV.
- CTSV quản lý lớp, sinh viên, tài khoản sinh viên, lập/gửi yêu cầu phân công.
- Trưởng Khoa phân công CVHT thủ công hoặc tự động, cập nhật độ ưu tiên CVHT.
- CVHT xem lớp phụ trách, xem sinh viên, gửi yêu cầu dừng cố vấn.
- CTSV/Giám đốc duyệt cuối phân công và thay thế CVHT.
- Hệ thống thông báo theo role, mỗi role chỉ thấy thông báo đúng người nhận.
- Bảng dữ liệu hỗ trợ cân bằng cột, căn giữa cột số, export CSV hoặc XLSX.

## Công Nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React 18, Vite, React Router, Axios, xlsx |
| Backend nghiệp vụ | Node.js, Express, MySQL2, JWT, Multer, Nodemailer |
| Backend xác thực bổ sung | Spring Boot, Spring Security Crypto, JPA, JWT, OAuth2, Mail |
| Database | MySQL 8 |
| Local services | Docker Compose, Redis, phpMyAdmin |

Frontend đang route các request `/auth/*` sang `VITE_SPRING_BOOT_API_URL` mặc định `http://localhost:8080/api`. Các API nghiệp vụ còn lại dùng `VITE_API_URL` mặc định `http://localhost:5000/api`.

Node backend vẫn có module auth tương ứng, nhưng client hiện tại ưu tiên Spring Boot cho nhóm API xác thực.

## Cấu Trúc Dự Án

```txt
adivisor/
  Backend/
    src/
      config/              # Cấu hình env và database
      database/            # schema.sql, seed.sql, init-db.js
      middlewares/         # Authenticate, role guard, error handler
      modules/             # auth, admin, ctsv, khoa, covan, sinhvien, notifications
      utils/               # stateMachine, csv, ids, passwords, httpError
  BackendSpringBoot/       # Service xác thực/OAuth2/mail
  Frontend/
    src/
      api/
      components/
      context/
      pages/
      styles/
  docker-compose.yml
  AGENTS.md
  README.md
```

## Cài Đặt Và Khởi Chạy

### Yêu Cầu

- Docker Desktop và Docker Compose.
- Node.js 18+ nếu chạy thủ công Backend/Frontend.
- Java 21 nếu chạy thủ công `BackendSpringBoot`.
- MySQL 8 nếu không dùng Docker.

Cổng mặc định:

| Dịch vụ | Cổng |
| --- | --- |
| Frontend | `5173` |
| Node API | `5000` |
| Spring Boot API | `8080` |
| MySQL | `3306` |
| Redis | `6379` |
| phpMyAdmin | `8081` |

### Chạy Bằng Docker Compose

```bash
docker compose up -d --build
```

Địa chỉ sau khi chạy:

| Dịch vụ | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Node API | `http://localhost:5000/api` |
| Health check | `http://localhost:5000/api/health` |
| Spring Boot API | `http://localhost:8080/api` |
| phpMyAdmin | `http://localhost:8081` |

Lệnh hữu ích:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f backend-springboot
docker compose logs -f frontend
docker compose down
```

Khởi tạo lại database từ đầu:

```bash
docker compose down -v
docker compose up -d --build
```

### Chạy Thủ Công

Chạy MySQL/Redis bằng Docker nếu cần:

```bash
docker compose up -d mysql redis
```

Backend Node:

```bash
cd Backend
npm install
npm run db:init
npm run dev
```

Spring Boot:

```bash
cd BackendSpringBoot
.\mvnw.cmd spring-boot:run
```

Frontend:

```bash
cd Frontend
npm install
npm run dev
```

## Cấu Hình

Docker Compose đọc `.env` ở thư mục gốc nếu có. Các biến quan trọng:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000/api` | Node API nghiệp vụ |
| `VITE_SPRING_BOOT_API_URL` | `http://localhost:8080/api` | API xác thực |
| `DB_HOST` | `localhost` hoặc `mysql` | Host MySQL |
| `DB_NAME` | `adivisor` | Tên database |
| `DB_USER` | `adivisor` | User database |
| `DB_PASSWORD` | `adivisor_password` | Mật khẩu database |
| `JWT_SECRET` | `adivisor_dev_secret_change_me` | Secret ký access token |
| `JWT_REFRESH_SECRET` | `dev_refresh_secret_change_me` | Secret ký refresh token |
| `FRONTEND_URL` | `http://localhost:5173` | Origin frontend được phép gọi API |
| `SMTP_*` | tùy cấu hình | Gửi OTP quên mật khẩu |
| `GG_CLIENT_ID`, `GG_CLIENT_SECRET` | rỗng | Google OAuth2 nếu sử dụng |

## Tài Khoản Mẫu

Dữ liệu mẫu được tạo từ `Backend/src/database/seed.sql` khi chạy `npm run db:init`.

| Vai trò | Tài khoản | Mật khẩu mặc định |
| --- | --- | --- |
| Admin | `admin` | `admin` |
| CTSV | `CTSV01` | `ctsv` |
| Trưởng Khoa CNTT | `TKCNTT01` | `cntt02` |
| CVHT | `CVHT01` | `cvht` |
| Sinh viên | `SV001` | `0900000001` |

Sau lần đăng nhập đầu tiên, người dùng bắt buộc đổi mật khẩu. Khi đổi thành công, `TAI_KHOAN.da_doi_mk = true`.

## Vai Trò Và Chức Năng

| Vai trò | Chức năng |
| --- | --- |
| Admin | Xem nhóm nhân viên theo khoa, quản lý tài khoản nhân viên, quản lý thông tin CVHT, import Trưởng Khoa/CTSV/CVHT bằng CSV. |
| CTSV | CRUD lớp, import lớp, CRUD sinh viên, import sinh viên, tạo tài khoản sinh viên, gửi yêu cầu phân công, duyệt/từ chối phân công và thay thế, export CSV/XLSX. |
| Trưởng Khoa | Xem yêu cầu phân công thuộc khoa, cập nhật `uu_tien`, auto-assign, chọn CVHT thủ công, gửi danh sách lên CTSV, duyệt bước 1 yêu cầu thay thế. |
| CVHT | Xem hồ sơ, lớp đang phụ trách, sinh viên trong lớp, gửi yêu cầu dừng cố vấn, xem lịch sử yêu cầu đã gửi. |
| Sinh viên | Xem profile và CVHT đang phụ trách lớp mình. |

## Luồng Nghiệp Vụ

### Phân Công CVHT

Trạng thái chính trong `PHAN_CONG`:

```txt
Chờ phân công -> Đã phân công -> Chờ giám đốc duyệt -> Đã đóng
```

Quy trình:

1. CTSV tạo/import lớp và sinh viên.
2. CTSV bấm gửi yêu cầu cho các Khoa. Backend chỉ tạo `PHAN_CONG` mới cho lớp có sinh viên, chưa có CVHT và chưa có request active.
3. Trưởng Khoa chọn CVHT thủ công hoặc dùng auto-assign.
4. Auto-assign ưu tiên CVHT đúng chuyên ngành, `uu_tien` nhỏ hơn và còn dưới 2 lớp phụ trách.
5. Trưởng Khoa gửi danh sách lên CTSV/Giám đốc.
6. CTSV/Giám đốc duyệt cuối: cập nhật `LOP.ma_co_van`, đóng `PHAN_CONG`, gửi thông báo cho lớp, khoa và CVHT.
7. Nếu CTSV từ chối, request quay về `Chờ phân công` để Khoa xử lý lại.

Lưu ý:

- Lớp `Chưa có cố vấn` chưa đồng nghĩa với đã gửi yêu cầu.
- Nút gửi yêu cầu trên CTSV luôn mở; backend sẽ báo lỗi rõ nếu không có yêu cầu mới cần gửi.
- CTSV không nhận thông báo kết quả "đã phân công"; CTSV chỉ nhận thông báo khi có việc cần xử lý.

### Thay Thế CVHT

Trạng thái chính trong `YEU_CAU_THAY_THE`:

```txt
Chờ duyệt -> Khoa đang duyệt -> Khoa đã duyệt -> Giám đốc đang duyệt -> Giám đốc đã duyệt -> Đã đóng
```

Nhánh từ chối:

```txt
Bị từ chối
```

Quy trình:

1. CVHT gửi yêu cầu dừng cố vấn cho lớp đang phụ trách.
2. Backend tạo một `PHAN_CONG` phục vụ luồng thay thế, năm học lấy theo `currentAcademicYear()`, và tạo `YEU_CAU_THAY_THE = Chờ duyệt`.
3. Khoa nhận thông báo và duyệt bước 1.
4. Khi Khoa duyệt, Khoa chọn CVHT mới, lưu vào `PHAN_CONG`, chuyển request thành `Khoa đã duyệt`, gửi thông báo cho CTSV/Giám đốc cần xử lý tiếp.
5. CTSV/Giám đốc duyệt bước cuối, cập nhật `LOP.ma_co_van`, đóng `PHAN_CONG` và `YEU_CAU_THAY_THE`, gửi thông báo kết quả cho lớp, khoa, CVHT cũ và CVHT mới.
6. Nếu Khoa từ chối, chỉ thông báo CVHT và không báo CTSV.
7. Nếu CTSV/Giám đốc từ chối, thông báo lại Khoa và CVHT cũ.

Duplicate check của CVHT chỉ chặn các request active:

```txt
Chờ duyệt, Khoa đang duyệt, Khoa đã duyệt, Giám đốc đang duyệt
```

Request đã đóng/bị từ chối hoặc trạng thái legacy kết thúc không chặn gửi yêu cầu mới.

### Notification Engine

Thông báo được lưu trong `THONG_BAO` và `THONG_BAO_NGUOI_NHAN`.

- Admin xem toàn bộ thông báo.
- CTSV chỉ xem notification có recipient `loai_nguoi_nhan = 'ctsv'` và `ma_doi_tuong = 'ALL'`.
- Khoa chỉ xem thông báo gửi đúng `ma_khoa`.
- CVHT chỉ xem thông báo gửi đúng `ma_co_van`.
- Sinh viên xem thông báo theo `ma_lop`.

## Import Và Export

### Import CSV

| Chức năng | Endpoint | Cột cần có |
| --- | --- | --- |
| Import Trưởng Khoa | `POST /api/admin/faculty-heads/import` | Mã nhân viên, Họ và tên, Email, Khoa |
| Import nhân viên CTSV | `POST /api/admin/ctsv/import` | Mã nhân viên, Họ và tên, Email |
| Import thông tin CVHT | `POST /api/admin/advisors/info/import` | Mã nhân viên, Họ và tên, Số điện thoại, Khoa, Chuyên ngành, Ưu tiên |
| Import tài khoản CVHT | `POST /api/admin/advisors/accounts/import` | Mã nhân viên, Email |
| Import gộp CVHT | `POST /api/admin/advisors/full/import` | Mã nhân viên, Họ và tên, Số điện thoại, Email, Khoa, Chuyên ngành, Ưu tiên |
| Import lớp | `POST /api/ctsv/classes/import` | Mã lớp, Tên lớp, Mã khoa, Chuyên ngành |
| Import sinh viên | `POST /api/ctsv/students/import` | Mã sinh viên, Họ và tên, Email, Số điện thoại, Mã lớp |

### Export

CTSV có thể export danh sách phân công/thay thế đang chờ duyệt hoặc lịch sử:

- CSV: giữ định dạng `.csv`.
- Excel: xuất `.xlsx` bằng thư viện `xlsx`.

## API Chính

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh-token`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-reset-otp`
- `POST /api/auth/reset-password`

### Admin

- `GET /api/admin/faculties`
- `GET /api/admin/employee-groups`
- `GET /api/admin/employee-groups/:id/accounts`
- `PATCH /api/admin/employee-accounts/:id`
- `DELETE /api/admin/employee-accounts/:id`
- `GET /api/admin/faculties/:id/employees`
- `GET /api/admin/advisors/info`
- `GET /api/admin/advisor-groups/:id/advisors`
- `PATCH /api/admin/advisors/info/:id`
- `DELETE /api/admin/advisors/info/:id`
- `GET /api/admin/accounts`
- `PATCH /api/admin/accounts/:id/status`
- `POST /api/admin/faculty-heads/import`
- `POST /api/admin/ctsv/import`
- `POST /api/admin/advisors/info/import`
- `POST /api/admin/advisors/accounts/import`
- `POST /api/admin/advisors/full/import`

### CTSV

- `GET /api/ctsv/students`
- `POST /api/ctsv/students`
- `POST /api/ctsv/students/import`
- `PATCH /api/ctsv/students/:id`
- `PATCH /api/ctsv/students/:id/account-status`
- `DELETE /api/ctsv/students/:id`
- `GET /api/ctsv/class-groups`
- `GET /api/ctsv/classes`
- `POST /api/ctsv/classes`
- `POST /api/ctsv/classes/import`
- `POST /api/ctsv/classes/reset-advisors`
- `POST /api/ctsv/classes/send-to-faculties`
- `PATCH /api/ctsv/classes/:id`
- `DELETE /api/ctsv/classes/:id`
- `DELETE /api/ctsv/classes/:id/students`
- `GET /api/ctsv/assignments`
- `POST /api/ctsv/assignments`
- `POST /api/ctsv/assignments/approve-all`
- `POST /api/ctsv/assignments/reject-all`
- `POST /api/ctsv/assignments/:id/send`
- `POST /api/ctsv/assignments/:id/approve`
- `POST /api/ctsv/assignments/:id/reject`
- `GET /api/ctsv/replacement-requests`
- `POST /api/ctsv/replacement-requests/approve-all`
- `POST /api/ctsv/replacement-requests/reject-all`
- `POST /api/ctsv/replacement-requests/:id/approve`
- `POST /api/ctsv/replacement-requests/:id/reject`

### Trưởng Khoa

- `GET /api/khoa/assignments`
- `GET /api/khoa/advisors`
- `PATCH /api/khoa/advisors/:id/priority`
- `POST /api/khoa/assignments/auto-assign`
- `POST /api/khoa/assignments/submit-all`
- `POST /api/khoa/assignments/:id/assign`
- `POST /api/khoa/assignments/:id/submit`
- `GET /api/khoa/replacement-requests`
- `POST /api/khoa/replacement-requests/:id/approve-step-1`
- `POST /api/khoa/replacement-requests/:id/reject-step-1`

### CVHT

- `GET /api/covan/me`
- `GET /api/covan/classes`
- `GET /api/covan/classes/:id/students`
- `GET /api/covan/replacement-requests`
- `POST /api/covan/replacement-requests`

### Sinh Viên

- `GET /api/sinhvien/me`
- `GET /api/sinhvien/advisor`

### Thông Báo

- `GET /api/notifications`
- `POST /api/notifications`

## Quy Tắc Phân Quyền

- Mọi API nghiệp vụ yêu cầu đăng nhập và đã đổi mật khẩu.
- Role được kiểm tra bằng `loai_tai_khoan`.
- Admin quản lý tài khoản/dữ liệu CVHT, không khóa/xóa tài khoản admin.
- CTSV có quyền tổng hợp và duyệt cuối toàn hệ thống.
- Trưởng Khoa chỉ thao tác dữ liệu thuộc `ma_khoa` của mình.
- CVHT chỉ xem lớp mình phụ trách và sinh viên của lớp đó.
- Sinh viên chỉ xem thông tin lớp và CVHT của chính mình.
- Notification trả về theo recipient scope, không trả thông báo ngoài phạm vi role.

## Kiểm Thử

Kiểm tra backend Node:

```bash
node --check Backend/src/modules/auth/auth.service.js
node --check Backend/src/modules/admin/admin.service.js
node --check Backend/src/modules/ctsv/ctsv.service.js
node --check Backend/src/modules/khoa/khoa.service.js
node --check Backend/src/modules/covan/covan.service.js
node --check Backend/src/modules/sinhvien/sinhvien.service.js
node --check Backend/src/modules/notifications/notifications.service.js
```

Build frontend:

```bash
cd Frontend
npm run build
```

Kiểm tra thủ công đề xuất:

1. Đăng nhập Admin, đổi mật khẩu lần đầu, kiểm tra bảng tài khoản nhân viên và thông tin CVHT.
2. Đăng nhập CTSV, import/từng bước tạo lớp và sinh viên.
3. CTSV bấm gửi yêu cầu phân công.
4. Đăng nhập Trưởng Khoa, auto-assign hoặc chọn CVHT thủ công, gửi lên CTSV.
5. CTSV duyệt phân công, kiểm tra lớp có CVHT và thông báo đúng role.
6. Đăng nhập CVHT, gửi yêu cầu dừng cố vấn, kiểm tra bảng "Yêu cầu đã gửi".
7. Trưởng Khoa duyệt bước 1 và chọn CVHT mới.
8. CTSV/Giám đốc duyệt bước cuối, kiểm tra lịch sử thay thế ở các role.
9. Export CSV và XLSX từ CTSV.

## Xử Lý Sự Cố

### Frontend không đăng nhập được

Kiểm tra Spring Boot Auth API và Redis:

```bash
docker compose ps
docker compose logs -f backend-springboot
```

Kiểm tra biến frontend:

```env
VITE_SPRING_BOOT_API_URL=http://localhost:8080/api
```

### Database sai hoặc cần reset dữ liệu mẫu

Bằng Docker:

```bash
docker compose down -v
docker compose up -d --build
```

Bằng Node backend thủ công:

```bash
cd Backend
npm run db:init
```

### Không gửi được OTP

Kiểm tra SMTP trong `.env`. Nếu dùng Gmail, cần App Password.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM=your_gmail@gmail.com
```

### Đăng nhập sai quá nhiều lần

Hệ thống giới hạn 5 lần sai mật khẩu mỗi ngày cho một tên tài khoản. Trong môi trường phát triển có thể xóa bản ghi từ `DANG_NHAP_THAT_BAI` nếu cần mở lại ngay.

### Port đã được sử dụng

```powershell
netstat -ano | findstr :5000
netstat -ano | findstr :5173
netstat -ano | findstr :8080
netstat -ano | findstr :3306
```

## Ghi Chú Phát Triển

- Không tự ý đổi tên bảng/cột database.
- Không thêm bảng mới nếu chưa có nhu cầu nghiệp vụ rõ ràng.
- Khi thêm API, cần kiểm tra role và scope dữ liệu.
- Trạng thái phân công/thay thế phải đi qua `Backend/src/utils/stateMachine.js`.
- Khi triển khai thật, bắt buộc đổi secret JWT, mật khẩu database, cấu hình SMTP/OAuth và cookie secure.
