package com.example.backendspringboot.service;

import com.example.backendspringboot.dto.request.ForgotPasswordRequest;
import com.example.backendspringboot.dto.request.ResetPasswordRequest;
import com.example.backendspringboot.dto.request.VerifyResetOtpRequest;
import com.example.backendspringboot.entity.Account;
import com.example.backendspringboot.exception.ErrorCode;
import com.example.backendspringboot.exception.MyAppException;
import com.example.backendspringboot.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Service managing OTP password recovery generation, verify token issues,
 * SMTP notifications dispatching, and secure password resetting.
 * Mirrors the Node.js OtpService logic.
 */
@Service
@RequiredArgsConstructor
public class OtpService {
    private static final Base64.Encoder BASE64_URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder BASE64_URL_DECODER = Base64.getUrlDecoder();
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final AccountRepository accountRepository;
    private final JavaMailSender mailSender;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${jwt.signerKey}")
    private String signerKey;

    @Value("${app.otp.expires-in-seconds:300}")
    private long otpExpiresInSeconds;

    @Value("${app.password-reset.expires-in-seconds:900}")
    private long passwordResetExpiresInSeconds;

    @Value("${spring.mail.username:}")
    private String smtpUser;

    @Value("${app.smtp.from:${spring.mail.username:}}")
    private String smtpFrom;

    // ==================== Public API ====================

    /**
     * Handles forgot password email submission and OTP issue.
     * Matches Node.js OtpService.forgotPassword()
     */
    @Transactional(readOnly = true)
    public Map<String, Object> forgotPassword(ForgotPasswordRequest request) {
        if (smtpUser == null || smtpUser.isBlank()) {
            throw new MyAppException(ErrorCode.SMTP_NOT_CONFIGURED);
        }

        Account account = accountRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new MyAppException(ErrorCode.EMAIL_NOT_FOUND));

        if (!Boolean.TRUE.equals(account.getIsActive())) {
            throw new MyAppException(ErrorCode.ACCOUNT_BLOCKED);
        }

        String otp = generateOtp();
        String otpToken = signOtpToken(account, otp);
        sendPasswordResetOtp(account.getEmail(), otp);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Mã OTP đã được gửi về email. Vui lòng kiểm tra hộp thư.");
        result.put("otp_token", otpToken);
        result.put("expires_in", otpExpiresInSeconds + "s");
        return result;
    }

    /**
     * Verifies reset OTP token and issues reset password token.
     * Matches Node.js OtpService.verifyResetOtp()
     */
    public Map<String, Object> verifyResetOtp(VerifyResetOtpRequest request) {
        Map<String, Object> decoded = decodeJwtPayload(request.getOtpToken());
        if (decoded == null
                || decoded.get("ma_tai_khoan") == null
                || !"password_reset_otp".equals(decoded.get("purpose"))) {
            throw new MyAppException(ErrorCode.INVALID_OTP);
        }

        String accountId = String.valueOf(decoded.get("ma_tai_khoan"));
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new MyAppException(ErrorCode.INVALID_OTP));

        if (!Boolean.TRUE.equals(account.getIsActive())) {
            throw new MyAppException(ErrorCode.ACCOUNT_BLOCKED);
        }

        // Verify signature and expiry
        Map<String, Object> verified = verifyJwt(request.getOtpToken(), otpSecret(account));
        if (verified == null) {
            throw new MyAppException(ErrorCode.OTP_EXPIRED);
        }

        // Verify OTP hash
        String expectedHash = hashOtp(account, request.getOtp());
        if (!expectedHash.equals(verified.get("otp_hash"))) {
            throw new MyAppException(ErrorCode.OTP_WRONG);
        }

        // Issue reset token
        String resetToken = signResetToken(account);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Xác thực OTP thành công. Vui lòng đặt mật khẩu mới.");
        result.put("reset_token", resetToken);
        result.put("expires_in", passwordResetExpiresInSeconds + "s");
        return result;
    }

    /**
     * Final password recovery reset using reset token.
     * Matches Node.js OtpService.resetPassword()
     */
    @Transactional
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        // Validate password match
        if (!request.getMatKhauMoi().equals(request.getNhapLaiMatKhauMoi())) {
            throw new MyAppException(ErrorCode.PASSWORD_MISMATCH);
        }

        Map<String, Object> decoded = decodeJwtPayload(request.getResetToken());
        if (decoded == null
                || decoded.get("ma_tai_khoan") == null
                || !"password_reset".equals(decoded.get("purpose"))) {
            throw new MyAppException(ErrorCode.INVALID_RESET_TOKEN);
        }

        String accountId = String.valueOf(decoded.get("ma_tai_khoan"));
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new MyAppException(ErrorCode.INVALID_RESET_TOKEN));

        if (!Boolean.TRUE.equals(account.getIsActive())) {
            throw new MyAppException(ErrorCode.ACCOUNT_BLOCKED);
        }

        // Verify signature and expiry
        Map<String, Object> verified = verifyJwt(request.getResetToken(), resetSecret(account));
        if (verified == null) {
            throw new MyAppException(ErrorCode.RESET_TOKEN_EXPIRED);
        }

        account.setPassword(passwordEncoder.encode(request.getMatKhauMoi()));
        account.setIsPasswordChanged(true);
        accountRepository.save(account);

        return Map.of("message", "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.");
    }

    // ==================== Private helpers ====================

    /**
     * Secret for OTP token: signerKey + ":" + account.password + ":otp"
     * Matches Node.js _otpSecret()
     */
    private String otpSecret(Account account) {
        return signerKey + ":" + account.getPassword() + ":otp";
    }

    /**
     * Secret for reset token: signerKey + ":" + account.password
     * Matches Node.js _resetSecret()
     */
    private String resetSecret(Account account) {
        return signerKey + ":" + account.getPassword();
    }

    /**
     * SHA-256 hash of accountId:otp:signerKey
     * Matches Node.js _hashOtp()
     */
    private String hashOtp(Account account, String otp) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String input = account.getAccountId() + ":" + otp + ":" + signerKey;
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    /**
     * Generate 6-digit OTP (100000-999999)
     * Matches Node.js _generateOtp()
     */
    private String generateOtp() {
        int otp = 100000 + SECURE_RANDOM.nextInt(900000);
        return String.valueOf(otp);
    }

    /**
     * Sign OTP JWT token with claims: purpose, ma_tai_khoan, otp_hash
     */
    private String signOtpToken(Account account, String otp) {
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("purpose", "password_reset_otp");
        claims.put("ma_tai_khoan", account.getAccountId());
        claims.put("otp_hash", hashOtp(account, otp));
        claims.put("iat", Instant.now().getEpochSecond());
        claims.put("exp", Instant.now().plusSeconds(otpExpiresInSeconds).getEpochSecond());
        return signJwt(claims, otpSecret(account));
    }

    /**
     * Sign reset JWT token with claims: purpose, ma_tai_khoan
     */
    private String signResetToken(Account account) {
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("purpose", "password_reset");
        claims.put("ma_tai_khoan", account.getAccountId());
        claims.put("iat", Instant.now().getEpochSecond());
        claims.put("exp", Instant.now().plusSeconds(passwordResetExpiresInSeconds).getEpochSecond());
        return signJwt(claims, resetSecret(account));
    }

    /**
     * Send OTP email via Spring JavaMailSender
     */
    private void sendPasswordResetOtp(String email, String otp) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(smtpFrom);
            message.setTo(email);
            message.setSubject("Ma OTP dat lai mat khau Adivisor");
            message.setText(String.format(
                    "Ma OTP dat lai mat khau cua ban la %s. Ma co hieu luc trong %ds. "
                            + "Neu ban khong yeu cau, vui long bo qua email nay.",
                    otp, otpExpiresInSeconds));
            mailSender.send(message);
        } catch (Exception e) {
            throw new MyAppException(ErrorCode.MAIL_SEND_FAILED);
        }
    }

    // ==================== JWT helpers (matching JwtService pattern) ====================

    private String signJwt(Map<String, Object> claims, String secret) {
        try {
            String header = encodeJson(Map.of("alg", "HS256", "typ", "JWT"));
            String payload = encodeJson(claims);
            String signingInput = header + "." + payload;
            return signingInput + "." + hmacSha256(signingInput, secret);
        } catch (Exception e) {
            throw new RuntimeException("JWT signing failed", e);
        }
    }

    /**
     * Verify JWT: check signature + expiry. Returns claims or null.
     */
    private Map<String, Object> verifyJwt(String token, String secret) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) return null;

            String signingInput = parts[0] + "." + parts[1];
            String expectedSignature = hmacSha256(signingInput, secret);
            if (!MessageDigest.isEqual(
                    expectedSignature.getBytes(StandardCharsets.UTF_8),
                    parts[2].getBytes(StandardCharsets.UTF_8))) {
                return null;
            }

            Map<String, Object> claims = objectMapper.readValue(
                    BASE64_URL_DECODER.decode(parts[1]),
                    new com.fasterxml.jackson.core.type.TypeReference<>() {}
            );
            Number exp = (Number) claims.get("exp");
            if (exp == null || exp.longValue() <= Instant.now().getEpochSecond()) {
                return null;
            }
            return claims;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Decode JWT payload WITHOUT verification (like jwt.decode in Node.js).
     */
    private Map<String, Object> decodeJwtPayload(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) return null;
            return objectMapper.readValue(
                    BASE64_URL_DECODER.decode(parts[1]),
                    new com.fasterxml.jackson.core.type.TypeReference<>() {}
            );
        } catch (Exception e) {
            return null;
        }
    }

    private String encodeJson(Map<String, Object> value) throws Exception {
        return BASE64_URL_ENCODER.encodeToString(objectMapper.writeValueAsBytes(value));
    }

    private String hmacSha256(String value, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return BASE64_URL_ENCODER.encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    }
}
