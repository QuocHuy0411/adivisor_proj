package com.example.backendspringboot.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResetPasswordRequest {
    @NotBlank(message = "Vui lòng cung cấp reset token")
    @JsonProperty("reset_token")
    private String resetToken;

    @NotBlank(message = "Vui lòng nhập mật khẩu mới")
    @Size(min = 6, message = "Mật khẩu mới cần tối thiểu 6 ký tự")
    @JsonProperty("mat_khau_moi")
    private String matKhauMoi;

    @NotBlank(message = "Vui lòng nhập lại mật khẩu mới")
    @JsonProperty("nhap_lai_mat_khau_moi")
    private String nhapLaiMatKhauMoi;
}
