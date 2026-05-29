package com.example.backendspringboot.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginRequest {
    @NotNull(message = "Username must be not null")
    @JsonProperty("ten_tai_khoan")
    private String username;
    @NotNull(message = "Password must be not null")
    @JsonProperty("mat_khau")
    private String password;
}
