package com.example.backendspringboot.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ConversationResponse {

    private String maHoiThoai;
    private String maSinhVien;
    private String tenSinhVien;
    private String maCoVan;
    private String tenCoVan;
    private String emailCoVan;
    private String soDienThoaiCoVan;
    private String chuyenNganhCoVan;
    private String tenKhoaCoVan;
    private String maLop;
    private String tenLop;
    private LocalDateTime ngayTao;
    private long soTinNhanChuaDoc;
    private ChatMessageResponse tinNhanCuoi;
}
