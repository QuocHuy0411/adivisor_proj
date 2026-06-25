package com.example.backendspringboot.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ChatMessageResponse {

    private String maTinNhan;
    private String maHoiThoai;
    private String maNguoiGui;
    private String loaiNguoiGui;
    private String tenNguoiGui;
    private String noiDung;
    private Boolean daDoc;
    private LocalDateTime thoiGianGui;
}
