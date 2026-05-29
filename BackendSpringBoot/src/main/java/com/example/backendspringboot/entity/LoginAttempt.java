package com.example.backendspringboot.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDate;

@Entity
@Table(name = "DANG_NHAP_THAT_BAI")
@IdClass(LoginAttempt.LoginAttemptId.class)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginAttempt {

    @Id
    @Column(name = "ten_tai_khoan", length = 100, nullable = false)
    private String username;

    @Id
    @Column(name = "ngay", nullable = false)
    private LocalDate date;

    @Column(name = "so_lan", nullable = false)
    private int attemptCount;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoginAttemptId implements Serializable {
        private String username;
        private LocalDate date;
    }
}
