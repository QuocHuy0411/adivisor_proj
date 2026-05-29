package com.example.backendspringboot.configuration;
import com.example.backendspringboot.dto.general.AccountInfo;
import com.example.backendspringboot.exception.ErrorCode;
import com.example.backendspringboot.exception.MyAppException;
import com.example.backendspringboot.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.convert.converter.Converter;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class CustomJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken>{
    private final AccountRepository accountRepository;
    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        String accountId = jwt.getSubject();
        AccountInfo account = accountRepository.findById(accountId).orElseThrow(
                () -> new MyAppException(ErrorCode.ACCOUNT_NOT_EXISTED)
        );
        if (account.getStatus().equals("BLOCKED")) {
            throw new MyAppException(ErrorCode.ACCOUNT_BLOCKED);
        }
        List<SimpleGrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("ROLE_" + account.getRole())
        );
        return new JwtAuthenticationToken(jwt, authorities);
    }
}
