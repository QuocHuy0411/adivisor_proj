package com.example.backendspringboot.entity;

import com.example.backendspringboot.dto.general.AccountInfo;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "TAI_KHOAN")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Account implements AccountInfo {

    @Id
    @Column(name = "ma_tai_khoan", length = 50, nullable = false)
    private String accountId;

    @Column(name = "ten_tai_khoan", length = 100)
    private String username;

    @Column(name = "mat_khau", length = 255)
    private String password;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "loai_tai_khoan", length = 20)
    private String accountType;

    @Column(name = "da_doi_mk")
    private Boolean isPasswordChanged;

    @Column(name = "is_active")
    private Boolean isActive;

    @Override
    public String getId() {
        return this.accountId;
    }

    @Override
    public String getRole() {
        return this.accountType;
    }

    @Override
    public String getStatus() {
        return this.isActive != null ? this.isActive.toString() : "false";
    }
}