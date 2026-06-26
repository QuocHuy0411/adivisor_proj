package com.example.backendspringboot.service;

import com.example.backendspringboot.entity.Account;
import com.example.backendspringboot.exception.ErrorCode;
import com.example.backendspringboot.exception.MyAppException;
import com.example.backendspringboot.mapper.AccountMapper;
import com.example.backendspringboot.repository.AccountRepository;
import com.example.backendspringboot.util.CookieUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class CurrentUserService {

    private final JwtService jwtService;
    private final AccountRepository accountRepository;
    private final AccountMapper accountMapper;

    @Transactional(readOnly = true)
    public Map<String, Object> requireUser(HttpServletRequest request) {
        return requireUser(CookieUtil.readCookie(request, "accessToken"));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> requireUser(String accessToken) {
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
}
