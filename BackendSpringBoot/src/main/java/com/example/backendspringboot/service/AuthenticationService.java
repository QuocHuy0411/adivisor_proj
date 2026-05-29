package com.example.backendspringboot.service;

import com.example.backendspringboot.dto.request.ChangePasswordRequest;
import com.example.backendspringboot.dto.request.LoginRequest;
import com.example.backendspringboot.dto.response.AuthenticationResponse;
import com.example.backendspringboot.entity.Account;
import com.example.backendspringboot.exception.ErrorCode;
import com.example.backendspringboot.exception.MyAppException;
import com.example.backendspringboot.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthenticationService {
    private final AccountRepository accountRepository;
    private final JdbcTemplate jdbcTemplate;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${jwt.accessTokenExpiration:28800}")
    private long accessTokenExpiration;

    @Value("${jwt.refreshTokenExpiration:604800}")
    private long refreshTokenExpiration;

    @Transactional
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
        return buildUser(account);
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            deleteRefreshToken(refreshToken);
        }
    }

    @Transactional
    public void changePassword(String accessToken, ChangePasswordRequest request) {
        // Validate password match
        if (!request.getMatKhauMoi().equals(request.getNhapLaiMatKhauMoi())) {
            throw new MyAppException(ErrorCode.PASSWORD_MISMATCH);
        }

        Map<String, Object> user = me(accessToken);
        Account account = accountRepository.findById(String.valueOf(user.get("ma_tai_khoan")))
                .orElseThrow(() -> new MyAppException(ErrorCode.ACCOUNT_NOT_EXISTED));

        if (!passwordEncoder.matches(request.getMatKhauCu(), account.getPassword())) {
            throw new MyAppException(ErrorCode.OLD_PASSWORD_WRONG);
        }

        account.setPassword(passwordEncoder.encode(request.getMatKhauMoi()));
        account.setIsPasswordChanged(true);
        accountRepository.save(account);
    }

    private AuthenticationResponse buildSession(Account account) {
        Map<String, Object> user = buildUser(account);
        String accessToken = jwtService.generateAccessToken(user, accessTokenExpiration);
        String refreshToken = jwtService.generateRefreshToken(account.getAccountId(), refreshTokenExpiration);
        saveRefreshToken(account.getAccountId(), refreshToken);
        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .user(user)
                .build();
    }

    private Map<String, Object> buildUser(Account account) {
        Map<String, Object> profile = loadRoleProfile(account);
        if (profile.isEmpty()) {
            throw new MyAppException(ErrorCode.ROLE_PROFILE_NOT_FOUND);
        }

        Map<String, Object> user = new LinkedHashMap<>();
        user.put("ma_tai_khoan", account.getAccountId());
        user.put("ten_tai_khoan", account.getUsername());
        user.put("email", account.getEmail());
        user.put("loai_tai_khoan", account.getAccountType());
        user.put("da_doi_mk", Boolean.TRUE.equals(account.getIsPasswordChanged()));
        user.put("is_active", Boolean.TRUE.equals(account.getIsActive()));
        user.putAll(profile);
        return user;
    }

    private Map<String, Object> loadRoleProfile(Account account) {
        String sql = switch (account.getAccountType()) {
            case "admin" -> "SELECT ma_admin, ho_va_ten FROM QUAN_TRI_VIEN WHERE ma_tai_khoan = ?";
            case "ctsv" -> "SELECT ma_nhan_vien, ho_va_ten FROM NHAN_VIEN_CTSV WHERE ma_tai_khoan = ?";
            case "khoa" -> "SELECT ma_nhan_vien, ma_khoa, ho_va_ten FROM TRUONG_KHOA WHERE ma_tai_khoan = ?";
            case "covan" -> "SELECT ma_co_van, ma_khoa, ho_va_ten FROM CVHT WHERE ma_tai_khoan = ?";
            case "sinhvien" -> "SELECT ma_sinh_vien, ma_lop, ho_va_ten FROM SINH_VIEN WHERE ma_tai_khoan = ?";
            default -> null;
        };
        if (sql == null) {
            return Map.of();
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, account.getAccountId());
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }

    private void ensureLoginAttemptTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS DANG_NHAP_THAT_BAI (
                  ten_tai_khoan VARCHAR(100) NOT NULL,
                  ngay DATE NOT NULL,
                  so_lan INT NOT NULL DEFAULT 0,
                  PRIMARY KEY (ten_tai_khoan, ngay)
                )
                """);
    }

    private int countLoginFailuresToday(String username) {
        ensureLoginAttemptTable();
        List<Integer> rows = jdbcTemplate.query(
                "SELECT so_lan FROM DANG_NHAP_THAT_BAI WHERE ten_tai_khoan = ? AND ngay = CURDATE()",
                (rs, rowNum) -> rs.getInt("so_lan"),
                username
        );
        return rows.isEmpty() ? 0 : rows.get(0);
    }

    private void recordLoginFailure(String username) {
        ensureLoginAttemptTable();
        jdbcTemplate.update("""
                INSERT INTO DANG_NHAP_THAT_BAI (ten_tai_khoan, ngay, so_lan)
                VALUES (?, CURDATE(), 1)
                ON DUPLICATE KEY UPDATE so_lan = so_lan + 1
                """, username);
    }

    private void clearLoginFailures(String username) {
        ensureLoginAttemptTable();
        jdbcTemplate.update("DELETE FROM DANG_NHAP_THAT_BAI WHERE ten_tai_khoan = ? AND ngay = CURDATE()", username);
    }

    private void ensureRefreshTokensTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS REFRESH_TOKENS (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  ma_tai_khoan VARCHAR(100) NOT NULL,
                  token VARCHAR(500) NOT NULL,
                  expires_at DATETIME NOT NULL,
                  FOREIGN KEY (ma_tai_khoan) REFERENCES TAI_KHOAN(ma_tai_khoan) ON DELETE CASCADE
                )
                """);
    }

    private void saveRefreshToken(String accountId, String token) {
        ensureRefreshTokensTable();
        jdbcTemplate.update(
                "INSERT INTO REFRESH_TOKENS (ma_tai_khoan, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))",
                accountId,
                token,
                refreshTokenExpiration
        );
    }

    private boolean isRefreshTokenActive(String token) {
        ensureRefreshTokensTable();
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM REFRESH_TOKENS WHERE token = ? AND expires_at > NOW()",
                Integer.class,
                token
        );
        return count != null && count > 0;
    }

    private void deleteRefreshToken(String token) {
        ensureRefreshTokensTable();
        jdbcTemplate.update("DELETE FROM REFRESH_TOKENS WHERE token = ?", token);
    }
}
