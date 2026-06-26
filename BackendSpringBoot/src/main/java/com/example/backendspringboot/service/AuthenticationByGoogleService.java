package com.example.backendspringboot.service;

import com.example.backendspringboot.dto.response.AuthenticationResponse;
import com.example.backendspringboot.entity.Account;
import com.example.backendspringboot.entity.RefreshToken;
import com.example.backendspringboot.exception.ErrorCode;
import com.example.backendspringboot.exception.MyAppException;
import com.example.backendspringboot.mapper.AccountMapper;
import com.example.backendspringboot.repository.AccountRepository;
import com.example.backendspringboot.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthenticationByGoogleService {
    private final AccountRepository accountRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final AccountMapper accountMapper;

    @Value("${google.oauth.client-id:}")
    private String googleClientId;
    @Value("${google.oauth.client-secret:}")
    private String googleClientSecret;
    @Value("${google.oauth.redirect-url}")
    private String googleRedirectUri;

    @Value("${jwt.accessTokenExpiration:28800}")
    private long accessTokenExpiration;

    @Value("${jwt.refreshTokenExpiration:604800}")
    private long refreshTokenExpiration;

    public String buildGoogleLoginUrl() {
        if (googleClientId == null || googleClientId.isBlank()) {
            throw new MyAppException(ErrorCode.INVALID_PARAMETER);
        }
        return UriComponentsBuilder
                .fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
                .queryParam("client_id", googleClientId)
                .queryParam("redirect_uri", googleRedirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", "openid email profile")
                .queryParam("access_type", "offline")
                .queryParam("prompt", "select_account")
                .build()
                .encode()
                .toUriString();
    }

    @Transactional
    public AuthenticationResponse loginCustomerWithGoogle(String code) {
        if (googleClientId == null || googleClientId.isBlank() || googleClientSecret == null || googleClientSecret.isBlank()) {
            throw new MyAppException(ErrorCode.INVALID_PARAMETER);
        }

        RestClient restClient = RestClient.builder().build();
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", googleClientId);
        form.add("client_secret", googleClientSecret);
        form.add("redirect_uri", googleRedirectUri);
        form.add("grant_type", "authorization_code");

        Map tokenResponse = restClient.post()
                .uri("https://oauth2.googleapis.com/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {});

        String accessTokenGoogle = tokenResponse == null ? null : (String) tokenResponse.get("access_token");
        if (accessTokenGoogle == null) {
            throw new MyAppException(ErrorCode.UNAUTHENTICATED);
        }

        Map userInfo = restClient.get()
                .uri("https://www.googleapis.com/oauth2/v3/userinfo")
                .header("Authorization", "Bearer " + accessTokenGoogle)
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {});

        String email = userInfo == null ? null : (String) userInfo.get("email");
        Boolean emailVerified = userInfo == null ? null : (Boolean) userInfo.get("email_verified");
        if (email == null || email.isBlank()) {
            throw new MyAppException(ErrorCode.UNAUTHENTICATED);
        }
        if (!Boolean.TRUE.equals(emailVerified)) {
            throw new MyAppException(ErrorCode.UNAUTHENTICATED);
        }

        Account account = accountRepository.findByEmail(email)
                .orElseThrow(() -> new MyAppException(ErrorCode.EMAIL_NOT_FOUND));
        if (!Boolean.TRUE.equals(account.getIsActive())) {
            throw new MyAppException(ErrorCode.ACCOUNT_BLOCKED);
        }

        Map<String, Object> user = accountMapper.toUserMap(account);
        String accessToken = jwtService.generateAccessToken(user, accessTokenExpiration);
        String refreshToken = jwtService.generateRefreshToken(account.getAccountId(), refreshTokenExpiration);
        saveRefreshToken(account.getAccountId(), refreshToken);

        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .user(user)
                .build();
    }

    private void saveRefreshToken(String accountId, String token) {
        RefreshToken refreshToken = RefreshToken.builder()
                .accountId(accountId)
                .token(token)
                .expiresAt(LocalDateTime.now().plusSeconds(refreshTokenExpiration))
                .build();
        refreshTokenRepository.save(refreshToken);
    }
}
