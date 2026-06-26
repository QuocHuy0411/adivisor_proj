package com.example.backendspringboot.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "HOI_THOAI")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Conversation {

    @Id
    @Column(name = "ma_hoi_thoai", length = 50, nullable = false)
    private String conversationId;

    @Column(name = "ma_sinh_vien", length = 50, nullable = false)
    private String studentId;

    @Column(name = "ma_co_van", length = 50, nullable = false)
    private String advisorId;

    @Column(name = "ma_lop", length = 50, nullable = false)
    private String classId;

    @Column(name = "ngay_tao", nullable = false)
    private LocalDateTime createdAt;
}
