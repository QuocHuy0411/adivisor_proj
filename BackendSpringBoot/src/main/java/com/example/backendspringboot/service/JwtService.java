package com.example.backendspringboot.service;

import com.example.backendspringboot.exception.ErrorCode;
import com.example.backendspringboot.exception.MyAppException;
import com.example.backendspringboot.dto.JwtObject.JwtInfo;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JOSEException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JwtService {
    private static final Base64.Encoder BASE64_URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder BASE64_URL_DECODER = Base64.getUrlDecoder();

    private final ObjectMapper objectMapper;

    @Value("${jwt.signerKey}")
    private String signerKey;

    @Value("${jwt.refreshSignerKey:${jwt.signerKey}}")
    private String refreshSignerKey;

    public String generateAccessToken(Map<String, Object> user, long expiresInSeconds) {
        Map<String, Object> claims = new LinkedHashMap<>(user);
        claims.put("iat", Instant.now().getEpochSecond());
        claims.put("exp", Instant.now().plusSeconds(expiresInSeconds).getEpochSecond());
        claims.put("jti", UUID.randomUUID().toString());
        claims.put("sub", user.get("ma_tai_khoan"));
        return sign(claims, signerKey);
    }

    public String generateRefreshToken(String accountId, long expiresInSeconds) {
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("ma_tai_khoan", accountId);
        claims.put("type", "refresh");
        claims.put("iat", Instant.now().getEpochSecond());
        claims.put("exp", Instant.now().plusSeconds(expiresInSeconds).getEpochSecond());
        return sign(claims, refreshSignerKey);
    }

    public Map<String, Object> verifyAccessToken(String token) {
        return verify(token, signerKey);
    }

    public JwtInfo parseToken(String token) throws JOSEException, ParseException {
        Map<String, Object> claims = verifyAccessToken(token);
        Number iat = (Number) claims.get("iat");
        Number exp = (Number) claims.get("exp");
        return JwtInfo.builder()
                .jwtId((String) claims.get("jti"))
                .subject((String) claims.get("sub"))
                .role((String) claims.get("loai_tai_khoan"))
                .issueTime(iat == null ? null : Date.from(Instant.ofEpochSecond(iat.longValue())))
                .expirationTime(exp == null ? null : Date.from(Instant.ofEpochSecond(exp.longValue())))
                .build();
    }

    public Map<String, Object> verifyRefreshToken(String token) {
        Map<String, Object> claims = verify(token, refreshSignerKey);
        if (!"refresh".equals(claims.get("type"))) {
            throw new MyAppException(ErrorCode.INVALID_TOKEN);
        }
        return claims;
    }

    private String sign(Map<String, Object> claims, String secret) {
        try {
            String header = encodeJson(Map.of("alg", "HS256", "typ", "JWT"));
            String payload = encodeJson(claims);
            String signingInput = header + "." + payload;
            return signingInput + "." + hmacSha256(signingInput, secret);
        } catch (Exception exception) {
            throw new MyAppException(ErrorCode.INVALID_TOKEN);
        }
    }

    private Map<String, Object> verify(String token, String secret) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                throw new MyAppException(ErrorCode.INVALID_TOKEN);
            }

            String signingInput = parts[0] + "." + parts[1];
            String expectedSignature = hmacSha256(signingInput, secret);
            if (!constantTimeEquals(expectedSignature, parts[2])) {
                throw new MyAppException(ErrorCode.INVALID_TOKEN);
            }

            Map<String, Object> claims = objectMapper.readValue(
                    BASE64_URL_DECODER.decode(parts[1]),
                    new TypeReference<>() {}
            );
            Number exp = (Number) claims.get("exp");
            if (exp == null || exp.longValue() <= Instant.now().getEpochSecond()) {
                throw new MyAppException(ErrorCode.INVALID_TOKEN);
            }
            return claims;
        } catch (MyAppException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new MyAppException(ErrorCode.INVALID_TOKEN);
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

    private boolean constantTimeEquals(String left, String right) {
        byte[] leftBytes = left.getBytes(StandardCharsets.UTF_8);
        byte[] rightBytes = right.getBytes(StandardCharsets.UTF_8);
        return java.security.MessageDigest.isEqual(leftBytes, rightBytes);
    }
}
