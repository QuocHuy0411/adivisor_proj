# Project Context

## 1. Mục tiêu dự án

Đây là hệ thống web phân công Cố vấn học tập cho lớp sinh viên.

Hệ thống hỗ trợ các vai trò:
- Quản trị viên
- Nhân viên phòng Công tác Sinh viên
- Trưởng Khoa
- Cố vấn học tập
- Sinh viên

Mục tiêu chính:
- Quản lý tài khoản người dùng.
- Quản lý thông tin CVHT, sinh viên, lớp.
- Lập danh sách lớp cần phân công CVHT.
- Trưởng Khoa phân công hoặc thay đổi CVHT cho lớp.
- CVHT gửi yêu cầu dừng cố vấn.
- Khoa duyệt bước 1.
- Phòng CTSV duyệt bước 2 và gửi thông báo.

## 2. Quy ước tài khoản

Bảng chính: TAI_KHOAN

Tên tài khoản:
- Sinh viên: dùng mã sinh viên.
- Các vai trò còn lại: dùng mã nhân viên.

Mật khẩu mặc định:
- Sinh viên: số điện thoại.
- Nhân viên phòng CTSV: ctsv.
- CVHT: cvht.
- Trưởng Khoa:
  - Công nghệ thông tin: cntt02
  - Viễn thông: vt02
  - Quản trị kinh doanh: qtkd02
  - Kỹ thuật điện tử: ktdt02
- Quản trị viên: admin.

Sau lần đăng nhập đầu tiên, người dùng bắt buộc đổi mật khẩu.
Trường `da_doi_mk` dùng để kiểm tra việc này.

## 3. Database schema

### TAI_KHOAN
- ma_tai_khoan: khóa chính
- ten_tai_khoan
- mat_khau
- email
- loai_tai_khoan: admin, ctsv, khoa, sinhvien, covan
- da_doi_mk
- is_active

### QUAN_TRI_VIEN
- ma_admin
- ma_tai_khoan
- ho_va_ten

### NHAN_VIEN_CTSV
- ma_nhan_vien
- ma_tai_khoan
- ho_va_ten

### KHOA
- ma_khoa
- ten_khoa

### TRUONG_KHOA
- ma_nhan_vien
- ma_tai_khoan
- ma_khoa
- ho_va_ten

### CVHT
- ma_co_van
- ma_tai_khoan
- ma_khoa
- ho_va_ten
- so_dien_thoai
- uu_tien
- chuyen_nganh

### LOP
- ma_lop
- ma_khoa
- ten_lop
- so_luong_sv
- chuyen_nganh
- nam_hoc
- ma_co_van
- trang_thai_lop

### SINH_VIEN
- ma_sinh_vien
- ma_tai_khoan
- ma_lop
- ho_va_ten
- so_dien_thoai

### PHAN_CONG
- ma_phan_cong
- ma_lop
- ma_co_van
- nam_hoc
- trang_thai
- ngay_phan_cong

### YEU_CAU_THAY_THE
- ma_yeu_cau
- ma_co_van
- ma_phan_cong
- ly_do
- trang_thai
- ngay_yeu_cau

### THONG_BAO
- ma_thong_bao
- ma_nhan_vien
- tieu_de
- noi_dung
- ngay_gui

### THONG_BAO_NGUOI_NHAN
- nguoi_nhan_id
- ma_thong_bao
- loai_nguoi_nhan
- ma_doi_tuong

## 4. Quy tắc nghiệp vụ quan trọng

### Quản trị viên
Có quyền:
- Tạo thông tin CVHT bằng file CSV.
- Sửa thông tin CVHT.
- Xóa thông tin CVHT.
- Tạo tài khoản nhân viên CTSV, Trưởng Khoa, CVHT.
- Xóa hoặc cập nhật trạng thái tài khoản nhân viên CTSV và Trưởng Khoa.

File CSV tạo CVHT cần có:
- Mã nhân viên
- Tên CVHT
- Email
- Số điện thoại
- Khoa
- Chuyên ngành
- Độ ưu tiên

### Nhân viên phòng CTSV
Có quyền:
- Tạo thông tin sinh viên.
- Sửa, xóa sinh viên.
- Tạo tài khoản sinh viên.
- Tạo, sửa, xóa lớp.
- Lập danh sách lớp cần CVHT.
- Gửi yêu cầu phân công CVHT cho Trưởng Khoa.
- Xem danh sách phân công/thay đổi từ Trưởng Khoa.
- Duyệt hoặc từ chối danh sách phân công/thay đổi.
- Gửi thông báo CVHT cho lớp, khoa và CVHT liên quan.

### Trưởng Khoa
Có quyền:
- Xem yêu cầu phân công CVHT do CTSV gửi.
- Xếp loại độ ưu tiên phân công CVHT.
- Phân công hoặc thay đổi CVHT cho lớp.
- Gửi danh sách phân công/thay đổi cho Phòng CTSV.
- Xem yêu cầu thay đổi CVHT do CVHT gửi.
- Duyệt hoặc từ chối yêu cầu thay đổi CVHT.
- Xem danh sách phân công CVHT cho các lớp.

### CVHT
Có quyền:
- Xem lớp đang phụ trách.
- Xem danh sách sinh viên lớp phụ trách.
- Gửi yêu cầu dừng cố vấn lên Khoa.
- Xem thông báo CVHT.

Mỗi CVHT phụ trách tối đa 2 lớp.

### Sinh viên
Có quyền:
- Xem thông tin CVHT phụ trách lớp mình.
- Xem thông báo thay đổi CVHT.

## 5. Luồng phân công CVHT

1. Phòng CTSV lập danh sách lớp cần CVHT.
2. Phòng CTSV gửi yêu cầu phân công cho Trưởng Khoa.
3. Trưởng Khoa xem danh sách lớp cần phân công.
5. Trưởng Khoa phân công CVHT cho lớp.
6. Trưởng Khoa gửi danh sách phân công cho Phòng CTSV.
7. Phòng CTSV duyệt hoặc từ chối.
8. Nếu duyệt, hệ thống cập nhật CVHT cho lớp.
9. Tự động gửi thông báo cho lớp, khoa và CVHT liên quan.

## 6. Luồng yêu cầu thay thế CVHT

1. CVHT gửi yêu cầu dừng cố vấn.
2. Trưởng Khoa xem xét lý do.
3. Trưởng Khoa duyệt hoặc từ chối.
4. Nếu duyệt, Trưởng Khoa phân công CVHT mới.
5. Trưởng Khoa gửi danh sách thay đổi cho Phòng CTSV.
6. Phòng CTSV duyệt bước cuối.
7. Nếu duyệt, cập nhật CVHT mới cho lớp.
8. Tự động gửi thông báo thay đổi CVHT cho lớp, khoa liên quan.

## 7. Trạng thái

### Trạng thái tài khoản
- Hoạt động
- Ngừng hoạt động

### Trạng thái yêu cầu phân công
- Chờ phân công
- Đang phân công
- Đã phân công
- Đã đóng

### Trạng thái danh sách phân công/thay đổi gửi CTSV
- Chờ duyệt
- Đang duyệt
- Đã duyệt
- Đã đóng
- Bị từ chối

### Trạng thái yêu cầu thay thế CVHT
- Chờ duyệt
- Khoa đang duyệt
- Khoa đã duyệt
- Giám đốc đang duyệt
- Giám đốc đã duyệt
- Đã đóng
- Bị từ chối

## 8. Nguyên tắc khi code

Khi implement chức năng:
- Không tự ý đổi tên bảng, tên cột.
- Không tự ý thêm bảng mới nếu chưa cần thiết.
- Nếu cần thêm bảng/trường, phải giải thích lý do.
- Luôn kiểm tra quyền theo `loai_tai_khoan`.
- Các API cần phân biệt rõ vai trò:
  - admin
  - ctsv
  - khoa
  - covan
  - sinhvien
- Không cho người dùng truy cập dữ liệu ngoài phạm vi vai trò của họ.
- Sinh viên chỉ xem CVHT của lớp mình.
- CVHT chỉ xem lớp mình phụ trách.
- Trưởng Khoa chỉ thao tác dữ liệu thuộc khoa mình.
- Phòng CTSV có quyền tổng hợp và duyệt toàn hệ thống.
- Admin chủ yếu quản lý tài khoản và dữ liệu CVHT.

## 9. Yêu cầu kỹ thuật khi Codex thực hiện task

Trước khi sửa code, hãy:
1. Đọc cấu trúc thư mục project.
2. Tìm các file liên quan đến module cần sửa.
3. Kiểm tra entity/model hiện có.
4. Kiểm tra controller/service/repository hiện có.
5. Chỉ sửa đúng phạm vi task.
6. Không rewrite toàn bộ project.
7. Sau khi sửa xong, liệt kê:
   - File đã sửa
   - Logic đã thêm
   - API đã thêm hoặc thay đổi
   - Cách test

ĐẶC TẢ LUỒNG TRẠNG THÁI (STATE MACHINE LOGIC)

AI Agent cần tuân thủ nghiêm ngặt các bước chuyển trạng thái (State transitions) dưới đây, không được nhảy cóc:

### Luồng A: Quy trình yêu cầu phân công lớp mới (Bảng PHAN_CONG)
Luồng chuyển dịch trạng thái hợp lệ của trường `trang_thai`:
1. `Chờ phân công` (Phòng CTSV thiết lập danh sách)
2. `Đang phân công` (Gửi yêu cầu về cho các Khoa thực hiện xếp)
3. `Đã phân công` (Khoa đã xếp xong cố vấn và gửi ngược lại CTSV)
4. `Đã đóng` (Phòng CTSV tổng hợp, trình Giám đốc duyệt và đóng chu trình)

### Luồng B: Quy trình gửi danh sách phân công/thay đổi của Khoa (KHOA_QĐ3)
Khi Khoa gửi danh sách lên Phòng CTSV để chờ xét duyệt, trường `trang_thai` biến đổi như sau:
* `Chờ duyệt` -> `Đang duyệt` -> `Đã duyệt` -> `Đã đóng`.
* Nhánh rẽ: Nếu Phòng CTSV không đồng ý, trạng thái chuyển sang `Bị từ chối` và trả lại luồng cho Khoa chỉnh sửa.

### Luồng C: Quy trình Cố vấn xin dừng/thay đổi lớp phụ trách (Bảng YEU_CAU_THAY_THE)
Nghiệp vụ đổi cố vấn này gồm **2 bước duyệt** (Khoa duyệt bước 1, CTSV duyệt bước 2). Luồng dịch chuyển trạng thái của trường `trang_thai` trong bảng `YEU_CAU_THAY_THE` bắt buộc tuân theo sơ đồ sau:
1. Khởi tạo: `Chờ duyệt` (Khi CVHT gửi đơn kèm lý do chính đáng)
2. Duyệt cấp Khoa: `Chờ duyệt` -> `Đang duyệt bước 1` -> `Đã duyệt bước 1`. (Nếu Trưởng khoa không chấp nhận -> `Bị từ chối`).
3. Duyệt cấp Phòng CTSV: `Đã duyệt bước 1` -> `Đang duyệt bước 2` -> `Đã duyệt bước 2`. (Nếu CTSV không chấp nhận -> `Bị từ chối` ở bước 2).
4. Kết thúc: `Đã duyệt bước 2` -> `Đã đóng` (Hệ thống tự động cập nhật lại `ma_co_van` mới vào bảng `LOP`, cập nhật bảng `PHAN_CONG`, đồng thời kích hoạt hành vi gửi thông báo tự động).

