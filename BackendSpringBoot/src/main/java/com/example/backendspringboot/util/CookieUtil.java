package com.example.backendspringboot.util;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseCookie;

import java.time.Duration;

/**
 * Utility class cho các thao tác cookie trong authentication flow.
 */
public final class CookieUtil {

    private CookieUtil() {
        // Utility class - không cho phép khởi tạo
    }

    /**
     * Thêm cookie HTTP-only vào response.
     */
    public static void addCookie(HttpServletResponse response, String name, String value,
                                 Duration maxAge, boolean secure) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path("/")
                .maxAge(maxAge)
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    /**
     * Xóa cookie bằng cách set maxAge = 0.
     */
    public static void clearCookie(HttpServletResponse response, String name, boolean secure) {
        ResponseCookie cookie = ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    /**
     * Đọc giá trị cookie từ request theo tên.
     * Trả về null nếu không tìm thấy.
     */
    public static String readCookie(HttpServletRequest request, String name) {
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
