package com.example.backendspringboot.service;

import com.example.backendspringboot.dto.request.ChangePasswordRequest;
import com.example.backendspringboot.dto.request.LoginRequest;
import com.example.backendspringboot.dto.response.AuthenticationResponse;
import com.example.backendspringboot.entity.Account;
import com.example.backendspringboot.entity.LoginAttempt;
import com.example.backendspringboot.entity.LoginAttempt.LoginAttemptId;
import com.example.backendspringboot.entity.RefreshToken;
import com.example.backendspringboot.exception.ErrorCode;
import com.example.backendspringboot.exception.MyAppException;
import com.example.backendspringboot.mapper.AccountMapper;
import com.example.backendspringboot.repository.AccountRepository;
import com.example.backendspringboot.repository.LoginAttemptRepository;
import com.example.backendspringboot.repository.RefreshTokenRepository;
import com.example.backendspringboot.validator.PasswordValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthenticationService {
    private final AccountRepository accountRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final AccountMapper accountMapper;
    private final PasswordValidator passwordValidator;
    private final BCryptPasswordEncoder passwordEncoder;

    @Value("${jwt.accessTokenExpiration:28800}")
    private long accessTokenExpiration;

    @Value("${jwt.refreshTokenExpiration:604800}")
    private long refreshTokenExpiration;

    @Transactional(noRollbackFor = MyAppException.class)
    public AuthenticationResponse login(LoginRequest loginRequest) {
        String username = loginRequest.getUsername();
        if (countLoginFailuresToday(username) >= 5) {
            throw new MyAppException(ErrorCode.TOO_MANY_LOGIN_ATTEMPTS);
        }

        Account account = accountRepository.findByUsername(username).orElse(null);
        if (account == null || !passwordEncoder.matches(loginRequest.getPassword(), account.getPassword())) {
            recordLoginFailure(username);
            throw new MyAppException(ErrorCode.INVALID_CREDENTIALS);
        }

        if (!Boolean.TRUE.equals(account.getIsActive())) {
            throw new MyAppException(ErrorCode.ACCOUNT_BLOCKED);
        }

        clearLoginFailures(username);
        return buildSession(account);
    }

    @Transactional
    public AuthenticationResponse refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank() || !isRefreshTokenActive(refreshToken)) {
            throw new MyAppException(ErrorCode.INVALID_TOKEN);
        }

        Map<String, Object> claims = jwtService.verifyRefreshToken(refreshToken);
        String accountId = String.valueOf(claims.get("ma_tai_khoan"));
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new MyAppException(ErrorCode.ACCOUNT_NOT_EXISTED));
        if (!Boolean.TRUE.equals(account.getIsActive())) {
            deleteRefreshToken(refreshToken);
            throw new MyAppException(ErrorCode.ACCOUNT_BLOCKED);
        }

        deleteRefreshToken(refreshToken);
        return buildSession(account);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> me(String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new MyAppException(ErrorCode.UNAUTHENTICATED);
        }

        Map<String, Object> claims = jwtService.verifyAccessToken(accessToken);
        String accountId = String.valueOf(claims.get("ma_tai_khoan"));
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new MyAppException(ErrorCode.ACCOUNT_NOT_EXISTED));
        if (!Boolean.TRUE.equals(account.getIsActive())) {
            throw new MyAppException(ErrorCode.ACCOUNT_BLOCKED);
        }
        return accountMapper.toUserMap(account);
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            deleteRefreshToken(refreshToken);
        }
    }

    @Transactional
    public void changePassword(String accessToken, ChangePasswordRequest request) {
        passwordValidator.validatePasswordMatch(request.getMatKhauMoi(), request.getNhapLaiMatKhauMoi());

        Map<String, Object> user = me(accessToken);
        Account account = accountRepository.findById(String.valueOf(user.get("ma_tai_khoan")))
                .orElseThrow(() -> new MyAppException(ErrorCode.ACCOUNT_NOT_EXISTED));

        passwordValidator.validateOldPassword(request.getMatKhauCu(), account.getPassword());

        account.setPassword(passwordEncoder.encode(request.getMatKhauMoi()));
        account.setIsPasswordChanged(true);
        accountRepository.save(account);
    }

    // ==================== Private helpers ====================

    private AuthenticationResponse buildSession(Account account) {
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

    private int countLoginFailuresToday(String username) {
        return loginAttemptRepository
                .findByUsernameAndDate(username, LocalDate.now())
                .map(LoginAttempt::getAttemptCount)
                .orElse(0);
    }

    private void recordLoginFailure(String username) {
        LoginAttemptId id = new LoginAttemptId(username, LocalDate.now());
        LoginAttempt attempt = loginAttemptRepository.findById(id)
                .orElse(LoginAttempt.builder()
                        .username(id.getUsername())
                        .date(id.getDate())
                        .attemptCount(0)
                        .build());
        attempt.setAttemptCount(attempt.getAttemptCount() + 1);
        loginAttemptRepository.save(attempt);
    }

    private void clearLoginFailures(String username) {
        loginAttemptRepository.deleteByUsernameAndDate(username, LocalDate.now());
    }

    private void saveRefreshToken(String accountId, String token) {
        RefreshToken refreshToken = RefreshToken.builder()
                .accountId(accountId)
                .token(token)
                .expiresAt(LocalDateTime.now().plusSeconds(refreshTokenExpiration))
                .build();
        refreshTokenRepository.save(refreshToken);
    }

    private boolean isRefreshTokenActive(String token) {
        return refreshTokenRepository
                .findByTokenAndExpiresAtAfter(token, LocalDateTime.now())
                .isPresent();
    }

    private void deleteRefreshToken(String token) {
        refreshTokenRepository.deleteByToken(token);
    }
}
