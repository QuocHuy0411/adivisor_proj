package com.example.backendspringboot.repository;

import com.example.backendspringboot.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, String> {

    Optional<Conversation> findByStudentIdAndAdvisorId(String studentId, String advisorId);

    List<Conversation> findByStudentIdOrderByCreatedAtDesc(String studentId);

    List<Conversation> findByAdvisorIdOrderByCreatedAtDesc(String advisorId);
}
