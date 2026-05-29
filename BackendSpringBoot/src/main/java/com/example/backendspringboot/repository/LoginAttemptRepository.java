package com.example.backendspringboot.repository;

import com.example.backendspringboot.entity.LoginAttempt;
import com.example.backendspringboot.entity.LoginAttempt.LoginAttemptId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, LoginAttemptId> {

    /**
     * Tìm bản ghi đăng nhập thất bại theo tên tài khoản và ngày.
     */
    Optional<LoginAttempt> findByUsernameAndDate(String username, LocalDate date);

    /**
     * Xóa bản ghi đăng nhập thất bại theo tên tài khoản và ngày.
     */
    void deleteByUsernameAndDate(String username, LocalDate date);
}
