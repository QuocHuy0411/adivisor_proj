package com.example.backendspringboot.repository;

import com.example.backendspringboot.entity.ChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, String> {

    List<ChatMessage> findByConversationIdOrderBySentAtAsc(String conversationId, Pageable pageable);

    List<ChatMessage> findByConversationIdOrderBySentAtDesc(String conversationId, Pageable pageable);

    @Query("""
            SELECT COUNT(m) FROM ChatMessage m
            WHERE m.conversationId = :conversationId
              AND m.senderAccountId <> :accountId
              AND m.isRead = false
            """)
    long countUnreadForUser(@Param("conversationId") String conversationId,
                            @Param("accountId") String accountId);

    @Modifying
    @Query("""
            UPDATE ChatMessage m
            SET m.isRead = true
            WHERE m.conversationId = :conversationId
              AND m.senderAccountId <> :accountId
              AND m.isRead = false
            """)
    int markAsReadForUser(@Param("conversationId") String conversationId,
                          @Param("accountId") String accountId);
}
