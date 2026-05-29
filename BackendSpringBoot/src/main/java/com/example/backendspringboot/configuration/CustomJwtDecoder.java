package com.example.backendspringboot.configuration;

import com.example.backendspringboot.dto.JwtObject.JwtInfo;
import com.example.backendspringboot.exception.MyAppException;
import com.example.backendspringboot.service.JwtService;
import com.nimbusds.jose.JOSEException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import javax.crypto.spec.SecretKeySpec;
import java.text.ParseException;
import java.util.Objects;

@Slf4j
@Component
@RequiredArgsConstructor
public class CustomJwtDecoder implements JwtDecoder {
    private final JwtService jwtService;

    private NimbusJwtDecoder nimbusJwtDecoder = null;
    @Value("${jwt.signerKey}")
    private String signerKey;
    @Override
    public Jwt decode(String token) throws JwtException {
        try {
            JwtInfo jwtInfo = jwtService.parseToken(token);
            if(Objects.isNull(nimbusJwtDecoder)){
                SecretKeySpec secretKeySpec = new SecretKeySpec(signerKey.getBytes(), "HS256");
                nimbusJwtDecoder = NimbusJwtDecoder.withSecretKey(secretKeySpec)
                        .macAlgorithm(MacAlgorithm.HS256)
                        .build();
            }
        } catch (JOSEException | ParseException | MyAppException e) {
            throw new JwtException("INVALID_TOKEN_SECURITY");
        }

        return nimbusJwtDecoder.decode(token);

    }
}