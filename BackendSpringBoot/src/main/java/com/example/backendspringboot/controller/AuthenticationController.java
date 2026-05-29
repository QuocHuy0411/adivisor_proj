package com.example.backendspringboot.controller;

import com.example.backendspringboot.dto.request.ChangePasswordRequest;
import com.example.backendspringboot.dto.request.ForgotPasswordRequest;
import com.example.backendspringboot.dto.request.LoginRequest;
import com.example.backendspringboot.dto.request.ResetPasswordRequest;
import com.example.backendspringboot.dto.request.VerifyResetOtpRequest;
import com.example.backendspringboot.dto.response.AuthenticationResponse;
import com.example.backendspringboot.service.AuthenticationService;
import com.example.backendspringboot.service.OtpService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthenticationController {
    private final AuthenticationService authenticationService;
    private final OtpService otpService;

    @Value("${app.cookie.secure:false}")
    private boolean secureCookie;

    // ==================== Authentication & Credential routes ====================

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthenticationResponse session = authenticationService.login(request);
        attachSessionCookies(response, session);
        return session.getUser();
    }

    @PostMapping("/logout")
    public Map<String, String> logout(HttpServletRequest request, HttpServletResponse response) {
        authenticationService.logout(readCookie(request, "refreshToken"));
        clearCookie(response, "accessToken");
        clearCookie(response, "refreshToken");
        return Map.of("message", "Dang xuat thanh cong");
    }

    @PostMapping("/refresh-token")
    public Map<String, Object> refresh(HttpServletRequest request, HttpServletResponse response) {
        AuthenticationResponse session = authenticationService.refresh(readCookie(request, "refreshToken"));
        attachSessionCookies(response, session);
        return session.getUser();
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpServletRequest request) {
        return authenticationService.me(readCookie(request, "accessToken"));
    }

    @PostMapping("/change-password")
    public Map<String, String> changePassword(HttpServletRequest request,
                                               @Valid @RequestBody ChangePasswordRequest payload) {
        authenticationService.changePassword(readCookie(request, "accessToken"), payload);
        return Map.of("message", "Doi mat khau thanh cong");
    }

    // ==================== Password recovery / OTP routes ====================

    @PostMapping("/forgot-password")
    public Map<String, Object> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return otpService.forgotPassword(request);
    }

    @PostMapping("/verify-reset-otp")
    public Map<String, Object> verifyResetOtp(@Valid @RequestBody VerifyResetOtpRequest request) {
        return otpService.verifyResetOtp(request);
    }

    @PostMapping("/reset-password")
    public Map<String, String> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return otpService.resetPassword(request);
    }

    // ==================== Cookie helpers ====================

    private void attachSessionCookies(HttpServletResponse response, AuthenticationResponse session) {
        addCookie(response, "accessToken", session.getAccessToken(), Duration.ofHours(8));
        addCookie(response, "refreshToken", session.getRefreshToken(), Duration.ofDays(7));
    }

    private void addCookie(HttpServletResponse response, String name, String value, Duration maxAge) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/")
                .maxAge(maxAge)
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    private void clearCookie(HttpServletResponse response, String name) {
        ResponseCookie cookie = ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    private String readCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
