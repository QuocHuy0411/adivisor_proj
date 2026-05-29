package com.example.backendspringboot.mapper;

import com.example.backendspringboot.entity.Account;
import com.example.backendspringboot.enums.AccountType;
import com.example.backendspringboot.exception.ErrorCode;
import com.example.backendspringboot.exception.MyAppException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Mapper chuyển đổi Account entity thành user Map cho response.
 * Bao gồm cả việc load thông tin vai trò (role profile) từ bảng tương ứng.
 */
@Component
@RequiredArgsConstructor
public class AccountMapper {
    private final JdbcTemplate jdbcTemplate;

    /**
     * Chuyển Account thành Map chứa thông tin user đầy đủ (bao gồm role profile).
     * Tương đương logic buildUser() cũ trong AuthenticationService.
     */
    public Map<String, Object> toUserMap(Account account) {
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

    /**
     * Load thông tin vai trò từ bảng tương ứng dựa trên loai_tai_khoan.
     * Sử dụng AccountType enum để lấy SQL query phù hợp.
     */
    private Map<String, Object> loadRoleProfile(Account account) {
        AccountType accountType = AccountType.fromDbValue(account.getAccountType());
        if (accountType == null) {
            return Map.of();
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                accountType.getProfileQuery(), account.getAccountId());
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }
}
