# AI-CONTEXT - Adivisor

## Mục đích file

File này ghi lại bối cảnh kỹ thuật, ràng buộc nghiệp vụ, cấu trúc và trạng thái triển khai của dự án để AI hoặc lập trình viên đọc nhanh trước khi tiếp tục phát triển. Khi chỉnh sửa dự án, cần cập nhật file này.

## Bối cảnh dự án

Adivisor là hệ thống web phân công Cố vấn học tập cho lớp sinh viên.

Vai trò:

- `admin`: Quản trị viên
- `ctsv`: Nhân viên phòng Công tác Sinh viên
- `khoa`: Trưởng Khoa
- `covan`: Cố vấn học tập
- `sinhvien`: Sinh viên

Stack hiện tại:

- Backend: NodeJS, ExpressJS, JWT
- Frontend: ReactJS, Vite
- Database: MySQL 8
- Công cụ chạy: Docker Compose

## Ràng buộc quan trọng

- Không tự ý đổi tên bảng/cột.
- Không tự ý thêm bảng mới nếu chưa thật sự cần.
- API luôn kiểm tra `loai_tai_khoan`.
- Sinh viên chỉ xem dữ liệu lớp mình.
- CVHT chỉ xem lớp mình phụ trách.
- Trưởng Khoa chỉ thao tác dữ liệu thuộc khoa mình.
- CTSV có quyền tổng hợp và duyệt toàn hệ thống.
- Admin chủ yếu quản lý tài khoản và dữ liệu CVHT.

## Database

Các bảng đang dùng:

- `TAI_KHOAN`
- `QUAN_TRI_VIEN`
- `NHAN_VIEN_CTSV`
- `KHOA`
- `TRUONG_KHOA`
- `CVHT`
- `LOP`
- `SINH_VIEN`
- `PHAN_CONG`
- `YEU_CAU_THAY_THE`
- `THONG_BAO`
- `THONG_BAO_NGUOI_NHAN`

Điểm kỹ thuật đã điều chỉnh:

- `PHAN_CONG.ma_co_van` được để `NULL` vì khi CTSV lập danh sách ban đầu chưa có CVHT.
- `CVHT.ma_tai_khoan` được để `NULL` vì yêu cầu mới tách 2 bước: tạo thông tin CVHT trước, sau đó mới tạo tài khoản CVHT.
- Không thêm `ma_co_van_moi` vào `YEU_CAU_THAY_THE`. Thay vào đó:
  - `YEU_CAU_THAY_THE.ma_co_van` là CVHT cũ.
  - `PHAN_CONG.ma_co_van` là CVHT mới được Khoa đề xuất.

## State machine bắt buộc

### PHAN_CONG

```txt
Chờ phân công -> Đang phân công -> Đã phân công -> Đã đóng
```

### YEU_CAU_THAY_THE

```txt
Chờ duyệt -> Đang duyệt bước 1 -> Đã duyệt bước 1 -> Đang duyệt bước 2 -> Đã duyệt bước 2 -> Đã đóng
```

Nhánh từ chối:

```txt
Bị từ chối
```

State machine nằm tại:

- `Backend/src/utils/stateMachine.js`

## Những gì đã làm

### Backend

Đã tạo:

- `Backend/package.json`
- `Backend/Dockerfile`
- `Backend/.env.example`
- `Backend/src/app.js`
- `Backend/src/server.js`
- `Backend/src/config/env.js`
- `Backend/src/config/db.js`
- `Backend/src/database/schema.sql`
- `Backend/src/database/seed.sql`
- `Backend/src/database/init-db.js`
- `Backend/src/middlewares/auth.js`
- `Backend/src/middlewares/errorHandler.js`
- `Backend/src/utils/*`

Module đã triển khai:

- `auth`: đăng nhập, đổi mật khẩu, lấy thông tin người dùng.
- `admin`: quản lý tài khoản, CVHT, import CSV CVHT.
- `ctsv`: quản lý lớp/sinh viên, lập danh sách phân công, duyệt phân công, duyệt thay thế bước 2, gửi thông báo.
- `khoa`: xem yêu cầu thuộc khoa, phân công CVHT, duyệt thay thế bước 1.
- `covan`: xem lớp, xem sinh viên, gửi yêu cầu dừng cố vấn.
- `sinhvien`: xem thông tin cá nhân và CVHT lớp mình.
- `notifications`: xem và gửi thông báo.

Kiểm soát nghiệp vụ đã thêm:

- Kiểm tra giới hạn tối đa 2 lớp/CVHT khi Khoa chọn CVHT.
- Kiểm tra lại giới hạn tối đa 2 lớp/CVHT ở bước CTSV duyệt cuối để tránh vượt giới hạn khi có nhiều đề xuất song song.
- Không cho chọn CVHT mới trùng CVHT hiện tại trong luồng thay thế.
- Admin không tạo thủ công trên giao diện; tạo nhân sự bằng CSV.
- Admin có 2 import CSV chính trên giao diện: tài khoản Trưởng Khoa; thông tin và tài khoản CVHT.
- CSV dùng tên khoa đầy đủ qua cột `Khoa`, không dùng mã viết tắt trong file import. Backend vẫn nhận thêm `Tên khoa` để tương thích file cũ.
- Admin không được khóa tài khoản Admin.
- Trưởng Khoa chỉ phân công CVHT đã có tài khoản đang hoạt động.

CSV Admin hiện tại:

- Tài khoản Trưởng Khoa: `ma_nhan_vien`, `ho_va_ten`, `email`, `ten_khoa`.
- File CSV Trưởng Khoa do user cung cấp dùng header `Mã nhân viên`, `Họ và tên`, `Email`, `Khoa`; backend đã hỗ trợ các header này.
- Thông tin và tài khoản CVHT: ưu tiên header tiếng Việt `Mã cố vấn`, `Họ và tên`, `Số điện thoại`, `Email`, `Khoa`, `Chuyên ngành`, `Ưu tiên`.
- Backend import CVHT gộp vẫn giữ tương thích với một số header kỹ thuật cũ như `ma_co_van`, `ho_va_ten`, `so_dien_thoai`, `ten_khoa`.

Frontend Admin hiện tại:

- Thanh bên trái có cụm avatar mặc định, tên vai trò và nút tam giác. Menu tam giác gồm `Đổi mật khẩu` và `Đăng xuất`.
- Dashboard Admin hiển thị 2 khối import CSV.
- `Danh sách CVHT` đã đổi thành `Danh sách nhân viên`.
- Ban đầu hiển thị danh sách khoa gồm `ma_khoa`, `ten_khoa`; click `Xem nhân viên` mở modal danh sách nhân viên trong khoa.
- Modal nhân viên gồm: Mã, họ tên, chuyên ngành, email, tên tài khoản, vai trò, trạng thái, thao tác.
- Góp ý mới đã xử lý: gộp tạo thông tin và tài khoản CVHT thành một chức năng `Tạo thông tin và tài khoản Cố vấn học tập`; nút submit đổi thành `Tạo`; danh sách nhân viên chuyển sang modal khi bấm `Xem nhân viên`.
- Cụm tài khoản ở sidebar dùng avatar mặc định, hiển thị tên vai trò, có nút tam giác mở menu `Đổi mật khẩu` và `Đăng xuất`.
- Cụm tài khoản đã được đưa lên trên sidebar, giảm kích thước khoảng 10%, đổi màu nền theo màu chủ đạo web `#0f766e`.
- Cụm tài khoản hiện là phần tử đầu tiên của sidebar, nằm ở vùng trống trên cùng bên trái; sidebar padding giảm còn `18px` để cụm này sát vùng đầu cột hơn.
- Endpoint mới cho import CVHT gộp: `POST /api/admin/advisors/full/import`.

### Frontend

Đã tạo:

- React Vite app thủ công trong `Frontend/`.
- Auth context và API client Axios.
- Route guard theo JWT và `da_doi_mk`.
- Dashboard theo vai trò:
  - Admin
  - CTSV
  - Trưởng Khoa
  - CVHT
  - Sinh viên
- Trang thông báo chung.

### Docker

Đã tạo `docker-compose.yml` gồm:

- `mysql`
- `backend`
- `frontend`
- `phpmyadmin`

## Tài khoản seed

| Vai trò | Tài khoản | Mật khẩu |
| --- | --- | --- |
| admin | `admin` | `admin` |
| ctsv | `CTSV01` | `ctsv` |
| khoa | `TKCNTT01` | `cntt02` |
| covan | `CVHT01` | `cvht` |
| sinhvien | `SV001` | `0900000001` |

Tất cả tài khoản seed có `da_doi_mk = false`, nên cần đổi mật khẩu lần đầu.

## Việc cần kiểm tra tiếp

- Chạy `docker compose up --build`.
- Kiểm tra Backend tự chạy `npm run db:init`.
- Test lần lượt các luồng nghiệp vụ trong README.
- Nếu cần import Excel `.xlsx` thật, cần bổ sung thư viện đọc Excel. Hiện import đang hỗ trợ CSV.
- Nếu cần OTP quên mật khẩu thật, cần bổ sung cấu hình email service.

## Kiểm tra đã chạy

- `node --check` cho toàn bộ file `.js` trong `Backend/src`: đạt.
- `docker compose config --quiet`: đạt, nhưng môi trường hiện có cảnh báo quyền đọc `C:\Users\nguye\.docker\config.json`.
- Kiểm tra JSON cho `Backend/package.json` và `Frontend/package.json`: đạt.
- Kiểm tra nhanh encoding UTF-8 cho `README.md`, `AI-CONTEXT.md`, `Backend/src/database/schema.sql`: đạt.
- Khi chạy `docker compose up --build`, cổng `8080` bị chiếm bởi tiến trình khác nên đã đổi phpMyAdmin sang `http://localhost:8081`.
- Khi mở Frontend lần đầu, gặp `ReferenceError: React is not defined`; đã thêm `Frontend/vite.config.js` với `@vitejs/plugin-react` để JSX dùng React transform đúng.
- Sau khi restart `frontend`, màn hình login render được tại `http://localhost:5173/login`.
- API login seed `admin/admin` trả JWT thành công và yêu cầu đổi mật khẩu lần đầu (`da_doi_mk = false`).
- Sau chỉnh sửa Admin mới: `node --check` backend đạt, `docker compose up --build -d` đạt, `docker compose exec frontend npm run build` đạt.
- Đã kiểm tra MySQL trong container: `CVHT.ma_tai_khoan` hiện `Null = YES`.
- Sau chỉnh layout/menu/import gộp: `node --check` backend đạt, `docker compose exec frontend npm run build` đạt, `docker compose up --build -d` đạt, frontend `/login` trả HTTP 200, backend `/api/health` trả `ok`.
- Sau sửa import CSV Trưởng Khoa: hỗ trợ header `Họ và tên`; frontend import panel có catch lỗi và hiển thị thông báo thay vì im lặng. Đã chạy `node --check`, `frontend npm run build`, `docker compose up --build -d`.
- Sau yêu cầu mới: chú thích import Trưởng Khoa đổi sang header tiếng Việt có dấu; backend và chú thích CVHT gộp hỗ trợ `Mã cố vấn`, `Họ và tên`, `Số điện thoại`, `Email`, `Khoa`, `Chuyên ngành`, `Ưu tiên`.
- Đã bỏ câu chú thích về tên tài khoản/mật khẩu mặc định khỏi khối tạo thông tin và tài khoản CVHT.

## Nguyên tắc cập nhật file này

Khi có thay đổi mới, cập nhật:

- File đã sửa.
- Logic đã thêm hoặc thay đổi.
- API mới hoặc API thay đổi.
- Các ràng buộc nghiệp vụ mới.
- Việc còn dang dở hoặc cần kiểm thử thêm.
