package com.example.backendspringboot.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VerifyResetOtpRequest {
    @NotBlank(message = "Vui lòng cung cấp OTP token")
    @JsonProperty("otp_token")
    private String otpToken;

    @NotBlank(message = "Vui lòng nhập mã OTP")
    private String otp;
}
