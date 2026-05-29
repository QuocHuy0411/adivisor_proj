package com.example.backendspringboot.repository;

import com.example.backendspringboot.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AccountRepository extends JpaRepository<Account, String> {
    java.util.Optional<Account> findByUsername(String username);
    java.util.Optional<Account> findByEmail(String email);
}
