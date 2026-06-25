package com.example.backendspringboot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChatSocketMessageRequest {

    @NotBlank(message = "Ma hoi thoai khong duoc de trong")
    private String maHoiThoai;

    @NotBlank(message = "Noi dung tin nhan khong duoc de trong")
    @Size(max = 2000, message = "Noi dung tin nhan toi da 2000 ky tu")
    private String noiDung;
}
