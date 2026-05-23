# Adivisor - Hệ thống phân công Cố vấn học tập

## 1. Giới thiệu

Adivisor là hệ thống web hỗ trợ quản lý và phân công Cố vấn học tập cho lớp sinh viên. Hệ thống phục vụ 5 nhóm người dùng:

- Quản trị viên
- Nhân viên phòng Công tác Sinh viên
- Trưởng Khoa
- Cố vấn học tập
- Sinh viên

Mục tiêu chính là số hóa quy trình lập danh sách lớp cần cố vấn, phân công CVHT, duyệt thay đổi CVHT theo 2 cấp và gửi thông báo đến các bên liên quan.

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ |
| --- | --- |
| Backend | NodeJS, ExpressJS, JWT |
| Frontend | ReactJS, Vite |
| Cơ sở dữ liệu | MySQL 8 |
| Đóng gói | Docker, Docker Compose |

## 3. Cấu trúc thư mục

```txt
adivisor/
  Backend/
    src/
      config/
      database/
      middlewares/
      modules/
        auth/
        admin/
        ctsv/
        khoa/
        covan/
        sinhvien/
        notifications/
      utils/
  Frontend/
    src/
      api/
      components/
      context/
      pages/
      styles/
  docker-compose.yml
  README.md
  AI-CONTEXT.md
```

## 4. Hướng dẫn chạy dự án

### 4.1 Yêu cầu hệ thống

- **Docker Desktop** (bao gồm Docker Engine và Docker Compose)
- **Git** để clone repository
- **Cổng trống**: 5173 (Frontend), 5000 (Backend), 3306 (MySQL), 8081 (phpMyAdmin)

### 4.2 Chạy với Docker (Khuyến nghị)

**Bước 1:** Mở terminal tại thư mục gốc của dự án

```bash
cd adivisor
```

**Bước 2:** Khởi động toàn bộ ứng dụng bằng Docker Compose

```bash
docker compose up -d --build
```

`-d` giúp container chạy nền; sau khi lên xong, mở trình duyệt vào các địa chỉ localhost bên dưới.

Lần đầu tiên sẽ mất khoảng 2-3 phút để tải image, build container và khởi tạo database.

**Bước 3:** Truy cập các dịch vụ sau khi khởi động xong:

| Dịch vụ | URL |
| --- | --- |
| Frontend (React App) | `http://localhost:5173` |
| Backend API | `http://localhost:5000/api` |
| phpMyAdmin | `http://localhost:8081` |
| MySQL Server | `localhost:3306` |

**Bước 4:** Dừng ứng dụng khi không dùng nữa

```bash
docker compose down
```

### 4.3 Chạy ở chế độ Development (Không dùng Docker)

**Backend:**

```bash
cd Backend
npm install
npm run dev
```

Backend sẽ chạy tại `http://localhost:5000/api` và tự động reload khi code thay đổi.

**Frontend (Terminal khác):**

```bash
cd Frontend
npm install
npm run dev
```

Frontend sẽ chạy tại `http://localhost:5173`.

**Cơ sở dữ liệu:**

Bạn cần setup MySQL 8 trước:

```bash
cd Backend
node src/database/init-db.js
```

### 4.4 Lưu ý

- Backend sẽ tự động khởi tạo database khi container Docker khởi động.
- Nếu chạy development mode, cần cài MySQL 8 trên máy hoặc sử dụng container MySQL riêng.
- Database sẽ được khởi tạo lần đầu dựa trên script `schema.sql` và `seed.sql`.
- Mật khẩu MySQL mặc định trong Docker: `root`.

## 5. Tài khoản mẫu

Sau khi khởi tạo database, hệ thống có các tài khoản mẫu:

| Vai trò | Tài khoản | Mật khẩu mặc định |
| --- | --- | --- |
| Quản trị viên | `admin` | `admin` |
| CTSV | `CTSV01` | `ctsv` |
| Trưởng Khoa CNTT | `TKCNTT01` | `cntt02` |
| CVHT | `CVHT01` | `cvht` |
| Sinh viên | `SV001` | `0900000001` |

**Lưu ý:** Sau lần đăng nhập đầu tiên, người dùng **bắt buộc phải đổi mật khẩu** trước khi sử dụng các chức năng khác. Hãy chọn mật khẩu mạnh và lưu giữ an toàn.

## 6. Luồng nghiệp vụ chính

### 6.1 Phân công CVHT cho lớp mới

Trạng thái bảng `PHAN_CONG`:

```txt
Chờ phân công -> Đang phân công -> Đã phân công -> Đã đóng
```

Quy trình:

1. CTSV tạo/lập danh sách lớp cần CVHT.
2. CTSV gửi yêu cầu phân công cho Khoa.
3. Trưởng Khoa chọn CVHT phù hợp.
4. Trưởng Khoa gửi danh sách cho CTSV.
5. CTSV duyệt cuối.
6. Hệ thống cập nhật `LOP.ma_co_van`, đóng phân công và gửi thông báo.

### 6.2 CVHT xin dừng/thay thế lớp phụ trách

Trạng thái bảng `YEU_CAU_THAY_THE`:

```txt
Chờ duyệt -> Đang duyệt bước 1 -> Đã duyệt bước 1 -> Đang duyệt bước 2 -> Đã duyệt bước 2 -> Đã đóng
```

Nhánh từ chối:

```txt
Bị từ chối
```

Quy trình:

1. CVHT gửi yêu cầu dừng cố vấn.
2. Trưởng Khoa bắt đầu duyệt bước 1.
3. Trưởng Khoa chấp nhận hoặc từ chối.
4. Nếu chấp nhận, Trưởng Khoa chọn CVHT mới.
5. CTSV bắt đầu duyệt bước 2.
6. CTSV chấp nhận hoặc từ chối.
7. Nếu chấp nhận, hệ thống cập nhật lớp, đóng yêu cầu và gửi thông báo.

## 7. API chính

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-reset-otp`
- `POST /api/auth/reset-password`

### Admin

- `GET /api/admin/accounts`
- `GET /api/admin/faculties`
- `GET /api/admin/faculties/:id/employees`
- `PATCH /api/admin/accounts/:id/status`
- `POST /api/admin/faculty-heads/import`
- `POST /api/admin/advisors/full/import`

Admin không tạo thủ công trên giao diện. Các chức năng tạo nhân sự đều thực hiện bằng file CSV:

| Chức năng | Cột CSV bắt buộc | Ghi chú |
| --- | --- | --- |
| Tạo tài khoản Trưởng Khoa | `Mã nhân viên`, `Họ và tên`, `Email`, `Khoa` | Khoa phải ghi đầy đủ, ví dụ `Công nghệ thông tin` |
| Tạo thông tin và tài khoản CVHT | `Mã cố vấn`, `Họ và tên`, `Số điện thoại`, `Email`, `Khoa`, `Chuyên ngành`, `Ưu tiên` | Tạo thông tin CVHT và tài khoản CVHT trong cùng một lần import |

### CTSV

- `GET /api/ctsv/classes`
- `POST /api/ctsv/classes`
- `GET /api/ctsv/students`
- `POST /api/ctsv/students`
- `GET /api/ctsv/assignments`
- `POST /api/ctsv/assignments`
- `POST /api/ctsv/assignments/:id/send`
- `POST /api/ctsv/assignments/:id/approve`
- `POST /api/ctsv/assignments/:id/reject`
- `GET /api/ctsv/replacement-requests`
- `POST /api/ctsv/replacement-requests/:id/start-step-2`
- `POST /api/ctsv/replacement-requests/:id/approve`
- `POST /api/ctsv/replacement-requests/:id/reject`

### Trưởng Khoa

- `GET /api/khoa/assignments`
- `GET /api/khoa/advisors`
- `PATCH /api/khoa/advisors/:id/priority`
- `POST /api/khoa/assignments/:id/assign`
- `POST /api/khoa/assignments/:id/submit`
- `GET /api/khoa/replacement-requests`
- `POST /api/khoa/replacement-requests/:id/start-step-1`
- `POST /api/khoa/replacement-requests/:id/approve-step-1`
- `POST /api/khoa/replacement-requests/:id/reject-step-1`

### CVHT

- `GET /api/covan/me`
- `GET /api/covan/classes`
- `GET /api/covan/classes/:id/students`
- `POST /api/covan/replacement-requests`
- `GET /api/covan/replacement-requests`

### Sinh viên

- `GET /api/sinhvien/me`
- `GET /api/sinhvien/advisor`

### Thông báo

- `GET /api/notifications`
- `POST /api/notifications`

## 8. Quy tắc phân quyền

- Admin quản lý tài khoản và dữ liệu CVHT.
- Admin không được khóa tài khoản Admin.
- CTSV quản lý sinh viên, lớp, phân công và duyệt toàn hệ thống.
- Trưởng Khoa chỉ thao tác dữ liệu thuộc `ma_khoa` của mình.
- CVHT chỉ xem lớp mình phụ trách và sinh viên trong các lớp đó.
- Sinh viên chỉ xem thông tin CVHT của lớp mình.

## 9. Lưu ý triển khai

- Không đổi tên bảng và cột so với thiết kế.
- `PHAN_CONG.ma_co_van` cho phép `NULL` vì khi CTSV lập danh sách ban đầu chưa có CVHT.
- `CVHT.ma_tai_khoan` cho phép `NULL` vì Admin phải tạo thông tin CVHT trước, sau đó mới import tài khoản CVHT.
- Luồng thay thế CVHT không thêm bảng mới. Hệ thống dùng:
  - `YEU_CAU_THAY_THE.ma_co_van`: CVHT cũ gửi yêu cầu.
  - `PHAN_CONG.ma_co_van`: CVHT mới được Khoa đề xuất.
- Mỗi CVHT phụ trách tối đa 2 lớp.
- CVHT có `uu_tien = 3` không được phân công theo quy định nghiệp vụ hiện tại.

## 10. Troubleshooting

### Lỗi: Port đã được sử dụng

**Triệu chứng:** `bind EADDRINUSE: address already in use :::5000` hoặc tương tự

**Giải pháp:**

- Cách 1: Dừng ứng dụng đang chạy trên port đó
- Cách 2: Thay đổi port trong file `.env` (Backend) hoặc `vite.config.js` (Frontend)

### Lỗi: Docker Compose không khởi động được

**Triệu chứng:** `Cannot connect to Docker daemon` hoặc `docker-compose: command not found`

**Giải pháp:**

1. Kiểm tra Docker Desktop đã cài và chạy chưa
2. Khởi động lại Docker Desktop
3. Chạy lệnh: `docker compose version` để kiểm tra

### Lỗi: Database không khởi tạo

**Triệu chứng:** Lỗi khi đăng nhập hoặc không thấy dữ liệu

**Giải pháp:**

```bash
# Xóa container và volume cũ
docker compose down -v

# Khởi động lại
docker compose up -d --build
```

### Lỗi: CORS error khi gọi API

**Triệu chứng:** `Access to XMLHttpRequest blocked by CORS policy`

**Giải pháp:**

- Kiểm tra Backend chạy tại `http://localhost:5000`
- Kiểm tra file `src/app.js` trong Backend có cấu hình CORS đúng không

### Lỗi: Không thể đăng nhập

**Triệu chứng:** Đăng nhập thất bại hoặc mật khẩu sai

**Giải pháp:**

1. Kiểm tra tên tài khoản và mật khẩu đúng không (xem mục 5)
2. Xóa localStorage browser: `F12` -> `Application` -> `Local Storage` -> xóa
3. Thử đăng nhập tài khoản khác để kiểm tra

### Cảnh báo: Nodemailer vulnerability

**Triệu chứng:** `npm audit` báo 1 high severity vulnerability

**Giải pháp:**

```bash
cd Backend
npm audit fix --force
npm install
```

### Lỗi: Frontend không load CSS/JS

**Triệu chứng:** Trang trắng hoặc lỗi 404 trên console

**Giải pháp:**

```bash
cd Frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 11. Kiểm thử thủ công đề xuất

1. Đăng nhập admin, đổi mật khẩu, tạo CVHT hoặc nhân sự.
2. Đăng nhập CTSV, tạo lớp và lập danh sách phân công.
3. CTSV gửi yêu cầu cho Khoa.
4. Đăng nhập Trưởng Khoa, chọn CVHT và gửi CTSV.
5. CTSV duyệt danh sách.
6. Đăng nhập Sinh viên để xem CVHT lớp mình.
7. Đăng nhập CVHT, gửi yêu cầu dừng cố vấn.
8. Trưởng Khoa duyệt bước 1 và chọn CVHT mới.
9. CTSV duyệt bước 2.
10. Kiểm tra thông báo ở các tài khoản liên quan.
