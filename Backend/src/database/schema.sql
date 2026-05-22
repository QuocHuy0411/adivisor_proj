CREATE TABLE IF NOT EXISTS TAI_KHOAN (
  ma_tai_khoan VARCHAR(50) PRIMARY KEY,
  ten_tai_khoan VARCHAR(100) NOT NULL UNIQUE,
  mat_khau VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  loai_tai_khoan VARCHAR(20) NOT NULL,
  da_doi_mk BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (loai_tai_khoan IN ('admin', 'ctsv', 'khoa', 'sinhvien', 'covan'))
);

CREATE TABLE IF NOT EXISTS QUAN_TRI_VIEN (
  ma_admin VARCHAR(50) PRIMARY KEY,
  ma_tai_khoan VARCHAR(50) NOT NULL UNIQUE,
  ho_va_ten VARCHAR(255) NOT NULL,
  FOREIGN KEY (ma_tai_khoan) REFERENCES TAI_KHOAN(ma_tai_khoan)
);

CREATE TABLE IF NOT EXISTS NHAN_VIEN_CTSV (
  ma_nhan_vien VARCHAR(50) PRIMARY KEY,
  ma_tai_khoan VARCHAR(50) NOT NULL UNIQUE,
  ho_va_ten VARCHAR(255) NOT NULL,
  FOREIGN KEY (ma_tai_khoan) REFERENCES TAI_KHOAN(ma_tai_khoan)
);

CREATE TABLE IF NOT EXISTS KHOA (
  ma_khoa VARCHAR(50) PRIMARY KEY,
  ten_khoa VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS TRUONG_KHOA (
  ma_nhan_vien VARCHAR(50) PRIMARY KEY,
  ma_tai_khoan VARCHAR(50) NOT NULL UNIQUE,
  ma_khoa VARCHAR(50) NOT NULL,
  ho_va_ten VARCHAR(255) NOT NULL,
  FOREIGN KEY (ma_tai_khoan) REFERENCES TAI_KHOAN(ma_tai_khoan),
  FOREIGN KEY (ma_khoa) REFERENCES KHOA(ma_khoa)
);

CREATE TABLE IF NOT EXISTS CVHT (
  ma_co_van VARCHAR(50) PRIMARY KEY,
  ma_tai_khoan VARCHAR(50) NULL UNIQUE,
  ma_khoa VARCHAR(50) NOT NULL,
  ho_va_ten VARCHAR(255) NOT NULL,
  so_dien_thoai VARCHAR(30) NOT NULL,
  uu_tien INT NOT NULL DEFAULT 2,
  chuyen_nganh VARCHAR(255) NOT NULL,
  FOREIGN KEY (ma_tai_khoan) REFERENCES TAI_KHOAN(ma_tai_khoan),
  FOREIGN KEY (ma_khoa) REFERENCES KHOA(ma_khoa),
  CHECK (uu_tien BETWEEN 1 AND 3)
);

CREATE TABLE IF NOT EXISTS LOP (
  ma_lop VARCHAR(50) PRIMARY KEY,
  ma_khoa VARCHAR(50) NOT NULL,
  ten_lop VARCHAR(255) NOT NULL,
  so_luong_sv INT NOT NULL DEFAULT 0,
  chuyen_nganh VARCHAR(255) NOT NULL,
  nam_hoc VARCHAR(20) NOT NULL,
  ma_co_van VARCHAR(50) NULL,
  trang_thai_lop VARCHAR(50) NOT NULL DEFAULT 'Chưa có cố vấn',
  FOREIGN KEY (ma_khoa) REFERENCES KHOA(ma_khoa),
  FOREIGN KEY (ma_co_van) REFERENCES CVHT(ma_co_van)
);

CREATE TABLE IF NOT EXISTS SINH_VIEN (
  ma_sinh_vien VARCHAR(50) PRIMARY KEY,
  ma_tai_khoan VARCHAR(50) NOT NULL UNIQUE,
  ma_lop VARCHAR(50) NOT NULL,
  ho_va_ten VARCHAR(255) NOT NULL,
  so_dien_thoai VARCHAR(30) NOT NULL,
  FOREIGN KEY (ma_tai_khoan) REFERENCES TAI_KHOAN(ma_tai_khoan),
  FOREIGN KEY (ma_lop) REFERENCES LOP(ma_lop)
);

CREATE TABLE IF NOT EXISTS PHAN_CONG (
  ma_phan_cong VARCHAR(50) PRIMARY KEY,
  ma_lop VARCHAR(50) NOT NULL,
  ma_co_van VARCHAR(50) NULL,
  nam_hoc VARCHAR(20) NOT NULL,
  trang_thai VARCHAR(50) NOT NULL,
  ngay_phan_cong DATE NULL,
  ten_truong_khoa VARCHAR(255) NULL,
  FOREIGN KEY (ma_lop) REFERENCES LOP(ma_lop),
  FOREIGN KEY (ma_co_van) REFERENCES CVHT(ma_co_van)
);

CREATE TABLE IF NOT EXISTS YEU_CAU_THAY_THE (
  ma_yeu_cau VARCHAR(50) PRIMARY KEY,
  ma_co_van VARCHAR(50) NOT NULL,
  ma_phan_cong VARCHAR(50) NOT NULL,
  ly_do VARCHAR(1000) NOT NULL,
  trang_thai VARCHAR(50) NOT NULL,
  ngay_yeu_cau DATE NOT NULL,
  ten_truong_khoa VARCHAR(255) NULL,
  FOREIGN KEY (ma_co_van) REFERENCES CVHT(ma_co_van),
  FOREIGN KEY (ma_phan_cong) REFERENCES PHAN_CONG(ma_phan_cong)
);

CREATE TABLE IF NOT EXISTS THONG_BAO (
  ma_thong_bao VARCHAR(50) PRIMARY KEY,
  ma_nhan_vien VARCHAR(50) NOT NULL,
  tieu_de VARCHAR(255) NOT NULL,
  noi_dung TEXT NOT NULL,
  ngay_gui DATE NOT NULL,
  FOREIGN KEY (ma_nhan_vien) REFERENCES NHAN_VIEN_CTSV(ma_nhan_vien)
);

CREATE TABLE IF NOT EXISTS THONG_BAO_NGUOI_NHAN (
  nguoi_nhan_id VARCHAR(50) PRIMARY KEY,
  ma_thong_bao VARCHAR(50) NOT NULL,
  loai_nguoi_nhan VARCHAR(50) NOT NULL,
  ma_doi_tuong VARCHAR(50) NOT NULL,
  FOREIGN KEY (ma_thong_bao) REFERENCES THONG_BAO(ma_thong_bao)
);

CREATE TABLE IF NOT EXISTS DANG_NHAP_THAT_BAI (
  ten_tai_khoan VARCHAR(100) NOT NULL,
  ngay DATE NOT NULL,
  so_lan INT NOT NULL DEFAULT 0,
  PRIMARY KEY (ten_tai_khoan, ngay)
);
