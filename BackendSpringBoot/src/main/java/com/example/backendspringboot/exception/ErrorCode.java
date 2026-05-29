package com.example.backendspringboot.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
public enum ErrorCode {
    INVALID_TOKEN(1002, "Invalid token exception", HttpStatus.UNAUTHORIZED),
    UNAUTHENTICATED(1001, "Unauthenticated exception", HttpStatus.UNAUTHORIZED),
    ACCOUNT_NOT_EXISTED(4003, "Tai khoan khong ton tai", HttpStatus.BAD_REQUEST),
    ACCOUNT_BLOCKED(4004, "Tai khoan da bi khoa", HttpStatus.UNAUTHORIZED),
    INVALID_CREDENTIALS(4005, "Sai ten tai khoan hoac mat khau", HttpStatus.UNAUTHORIZED),
    ROLE_PROFILE_NOT_FOUND(4006, "Tai khoan khong con ho so vai tro hop le", HttpStatus.FORBIDDEN),
    TOO_MANY_LOGIN_ATTEMPTS(4007, "Tai khoan da nhap sai mat khau 5 lan trong ngay. Vui long thu lai vao ngay mai.", HttpStatus.TOO_MANY_REQUESTS),
    BAD_REQUEST(4008, "Du lieu khong hop le", HttpStatus.BAD_REQUEST),
    EMAIL_NOT_FOUND(4009, "Email khong ton tai trong he thong", HttpStatus.BAD_REQUEST),
    SMTP_NOT_CONFIGURED(4010, "Chua cau hinh SMTP Gmail de gui ma OTP", HttpStatus.BAD_REQUEST),
    INVALID_OTP(4011, "Ma OTP khong hop le", HttpStatus.BAD_REQUEST),
    INVALID_PARAMETER(1006, "Invalid request parameters", HttpStatus.BAD_REQUEST),
    OTP_EXPIRED(4012, "Ma OTP da het han hoac khong hop le", HttpStatus.BAD_REQUEST),
    OTP_WRONG(4013, "Ma OTP khong dung", HttpStatus.BAD_REQUEST),
    INVALID_RESET_TOKEN(4014, "Ma dat lai mat khau khong hop le", HttpStatus.BAD_REQUEST),
    RESET_TOKEN_EXPIRED(4015, "Ma dat lai mat khau da het han hoac khong hop le", HttpStatus.BAD_REQUEST),
    PASSWORD_MISMATCH(4016, "Mat khau moi khong khop", HttpStatus.BAD_REQUEST),
    PASSWORD_TOO_SHORT(4017, "Mat khau moi can toi thieu 6 ky tu", HttpStatus.BAD_REQUEST),
    OLD_PASSWORD_WRONG(4018, "Mat khau cu khong dung", HttpStatus.BAD_REQUEST),
    MAIL_SEND_FAILED(4019, "Gui email that bai. Vui long thu lai sau.", HttpStatus.INTERNAL_SERVER_ERROR);

    private final int code;
    private final String message;
    private final HttpStatusCode statusCode;

    ErrorCode(int code, String message, HttpStatusCode statusCode) {
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
    }
}
