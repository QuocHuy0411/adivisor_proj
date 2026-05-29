package com.example.backendspringboot.repository;

import com.example.backendspringboot.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Integer> {

    /**
     * Tìm refresh token còn hiệu lực (chưa hết hạn).
     */
    Optional<RefreshToken> findByTokenAndExpiresAtAfter(String token, LocalDateTime now);

    /**
     * Xóa refresh token theo giá trị token.
     */
    void deleteByToken(String token);
}
