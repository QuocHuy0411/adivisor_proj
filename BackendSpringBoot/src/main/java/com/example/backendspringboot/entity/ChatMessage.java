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
@Table(name = "TIN_NHAN")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessage {

    @Id
    @Column(name = "ma_tin_nhan", length = 50, nullable = false)
    private String messageId;

    @Column(name = "ma_hoi_thoai", length = 50, nullable = false)
    private String conversationId;

    @Column(name = "ma_nguoi_gui", length = 50, nullable = false)
    private String senderAccountId;

    @Column(name = "loai_nguoi_gui", length = 20, nullable = false)
    private String senderRole;

    @Column(name = "noi_dung", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "da_doc", nullable = false)
    private Boolean isRead;

    @Column(name = "thoi_gian_gui", nullable = false)
    private LocalDateTime sentAt;
}
