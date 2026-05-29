package com.example.backendspringboot.dto.JwtObject;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JwtInfo {
    @Id
    private String jwtId;
    private String subject;
    private String role;
    private Date issueTime;
    private Date expirationTime;

}