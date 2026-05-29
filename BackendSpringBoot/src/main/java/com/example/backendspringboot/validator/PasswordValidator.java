package com.example.backendspringboot.validator;

import com.example.backendspringboot.exception.ErrorCode;
import com.example.backendspringboot.exception.MyAppException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Validator cho các nghiệp vụ liên quan đến mật khẩu.
 */
@Component
@RequiredArgsConstructor
public class PasswordValidator {

    private final BCryptPasswordEncoder passwordEncoder;

    /**
     * Kiểm tra mật khẩu mới và nhập lại có khớp nhau không.
     * @throws MyAppException nếu không khớp (PASSWORD_MISMATCH)
     */
    public void validatePasswordMatch(String newPassword, String confirmPassword) {
        if (!newPassword.equals(confirmPassword)) {
            throw new MyAppException(ErrorCode.PASSWORD_MISMATCH);
        }
    }

    /**
     * Kiểm tra mật khẩu cũ có đúng không.
     * @throws MyAppException nếu sai (OLD_PASSWORD_WRONG)
     */
    public void validateOldPassword(String rawPassword, String encodedPassword) {
        if (!passwordEncoder.matches(rawPassword, encodedPassword)) {
            throw new MyAppException(ErrorCode.OLD_PASSWORD_WRONG);
        }
    }
}
