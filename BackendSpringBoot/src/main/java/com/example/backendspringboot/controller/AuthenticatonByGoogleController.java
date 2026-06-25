package com.example.backendspringboot.controller;

import com.example.backendspringboot.dto.response.AuthenticationResponse;
import com.example.backendspringboot.exception.MyAppException;
import com.example.backendspringboot.service.AuthenticationByGoogleService;
import com.example.backendspringboot.util.CookieUtil;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
public class AuthenticatonByGoogleController {
    private final AuthenticationByGoogleService authenticationByGoogleService;

    @Value("${app.cookie.secure:false}")
    private boolean secureCookie;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @GetMapping("/google/login")
    public Map<String, String> googleLoginUrl() {
        return Map.of("url", authenticationByGoogleService.buildGoogleLoginUrl());
    }

    @GetMapping("/google/callback")
    public ResponseEntity<Void> googleCallback(@RequestParam("code") String code, HttpServletResponse response) {
        try {
            AuthenticationResponse session = authenticationByGoogleService.loginCustomerWithGoogle(code);
            CookieUtil.addCookie(response, "accessToken", session.getAccessToken(),
                    Duration.ofHours(8), secureCookie);
            CookieUtil.addCookie(response, "refreshToken", session.getRefreshToken(),
                    Duration.ofDays(7), secureCookie);

            String redirectUrl = UriComponentsBuilder
                    .fromUriString(frontendUrl)
                    .path("/login")
                    .queryParam("google", "success")
                    .build()
                    .toUriString();
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(HttpHeaders.LOCATION, URI.create(redirectUrl).toString())
                    .build();
        } catch (MyAppException e) {
            String errorMessage = URLEncoder.encode(e.getErrorCode().getMessage(), StandardCharsets.UTF_8);
            String errorCode = String.valueOf(e.getErrorCode().getCode());
            String redirectUrl = UriComponentsBuilder
                    .fromUriString(frontendUrl)
                    .path("/login")
                    .queryParam("google", "error")
                    .queryParam("error_code", errorCode)
                    .queryParam("error_message", errorMessage)
                    .build()
                    .toUriString();
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(HttpHeaders.LOCATION, URI.create(redirectUrl).toString())
                    .build();
        } catch (Exception e) {
            String errorMessage = URLEncoder.encode("Dang nhap Google that bai", StandardCharsets.UTF_8);
            String redirectUrl = UriComponentsBuilder
                    .fromUriString(frontendUrl)
                    .path("/login")
                    .queryParam("google", "error")
                    .queryParam("error_code", "0")
                    .queryParam("error_message", errorMessage)
                    .build()
                    .toUriString();
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(HttpHeaders.LOCATION, URI.create(redirectUrl).toString())
                    .build();
        }
    }
}
