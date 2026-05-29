package com.example.backendspringboot.enums;

import lombok.Getter;

@Getter
public enum AccountType {
    ADMIN("admin", "SELECT ma_admin, ho_va_ten FROM QUAN_TRI_VIEN WHERE ma_tai_khoan = ?"),
    CTSV("ctsv", "SELECT ma_nhan_vien, ho_va_ten FROM NHAN_VIEN_CTSV WHERE ma_tai_khoan = ?"),
    KHOA("khoa", "SELECT ma_nhan_vien, ma_khoa, ho_va_ten FROM TRUONG_KHOA WHERE ma_tai_khoan = ?"),
    COVAN("covan", "SELECT ma_co_van, ma_khoa, ho_va_ten FROM CVHT WHERE ma_tai_khoan = ?"),
    SINHVIEN("sinhvien", "SELECT ma_sinh_vien, ma_lop, ho_va_ten FROM SINH_VIEN WHERE ma_tai_khoan = ?");

    private final String dbValue;
    private final String profileQuery;

    AccountType(String dbValue, String profileQuery) {
        this.dbValue = dbValue;
        this.profileQuery = profileQuery;
    }

    /**
     * Tìm AccountType từ giá trị lưu trong DB (loai_tai_khoan).
     * Trả về null nếu không khớp.
     */
    public static AccountType fromDbValue(String dbValue) {
        if (dbValue == null) return null;
        for (AccountType type : values()) {
            if (type.dbValue.equals(dbValue)) {
                return type;
            }
        }
        return null;
    }
}
