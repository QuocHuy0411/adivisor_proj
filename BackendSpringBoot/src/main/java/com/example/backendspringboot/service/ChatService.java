package com.example.backendspringboot.service;

import com.example.backendspringboot.dto.request.OpenConversationRequest;
import com.example.backendspringboot.dto.request.SendChatMessageRequest;
import com.example.backendspringboot.dto.response.ChatMessageResponse;
import com.example.backendspringboot.dto.response.ConversationResponse;
import com.example.backendspringboot.entity.ChatMessage;
import com.example.backendspringboot.entity.Conversation;
import com.example.backendspringboot.enums.AccountType;
import com.example.backendspringboot.exception.ErrorCode;
import com.example.backendspringboot.exception.MyAppException;
import com.example.backendspringboot.repository.ChatMessageRepository;
import com.example.backendspringboot.repository.ConversationRepository;
import com.example.backendspringboot.util.IdGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public List<ConversationResponse> listConversations(Map<String, Object> user) {
        String role = String.valueOf(user.get("loai_tai_khoan"));
        List<Conversation> conversations;

        if (AccountType.SINHVIEN.getDbValue().equals(role)) {
            conversations = conversationRepository.findByStudentIdOrderByCreatedAtDesc(
                    String.valueOf(user.get("ma_sinh_vien")));
        } else if (AccountType.COVAN.getDbValue().equals(role)) {
            conversations = conversationRepository.findByAdvisorIdOrderByCreatedAtDesc(
                    String.valueOf(user.get("ma_co_van")));
        } else {
            throw new MyAppException(ErrorCode.CHAT_INVALID_ROLE);
        }

        List<ConversationResponse> responses = new ArrayList<>();
        for (Conversation conversation : conversations) {
            responses.add(toConversationResponse(conversation, user));
        }
        return responses;
    }

    @Transactional
    public ConversationResponse openConversation(Map<String, Object> user, OpenConversationRequest request) {
        String role = String.valueOf(user.get("loai_tai_khoan"));

        if (AccountType.SINHVIEN.getDbValue().equals(role)) {
            return openStudentConversation(user);
        }
        if (AccountType.COVAN.getDbValue().equals(role)) {
            if (request == null || request.getMaSinhVien() == null || request.getMaSinhVien().isBlank()) {
                throw new MyAppException(ErrorCode.BAD_REQUEST);
            }
            return openAdvisorConversation(user, request.getMaSinhVien());
        }
        throw new MyAppException(ErrorCode.CHAT_INVALID_ROLE);
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getMessages(Map<String, Object> user, String conversationId, int page, int size) {
        Conversation conversation = requireAccessibleConversation(user, conversationId);
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);

        List<ChatMessage> messages = chatMessageRepository.findByConversationIdOrderBySentAtDesc(
                conversation.getConversationId(),
                PageRequest.of(safePage, safeSize));
        messages = new ArrayList<>(messages);
        java.util.Collections.reverse(messages);

        return messages.stream()
                .map(message -> toMessageResponse(message, loadDisplayName(message.getSenderRole(), conversation)))
                .toList();
    }

    @Transactional
    public ChatMessageResponse sendMessage(Map<String, Object> user,
                                           String conversationId,
                                           SendChatMessageRequest request) {
        Conversation conversation = requireAccessibleConversation(user, conversationId);
        String content = request.getNoiDung().trim();
        if (content.isBlank()) {
            throw new MyAppException(ErrorCode.BAD_REQUEST);
        }

        String role = String.valueOf(user.get("loai_tai_khoan"));
        ChatMessage message = ChatMessage.builder()
                .messageId(IdGenerator.makeId("TN"))
                .conversationId(conversation.getConversationId())
                .senderAccountId(String.valueOf(user.get("ma_tai_khoan")))
                .senderRole(role)
                .content(content)
                .isRead(false)
                .sentAt(LocalDateTime.now())
                .build();

        chatMessageRepository.save(message);
        return toMessageResponse(message, String.valueOf(user.get("ho_va_ten")));
    }

    @Transactional
    public void markAsRead(Map<String, Object> user, String conversationId) {
        requireAccessibleConversation(user, conversationId);
        chatMessageRepository.markAsReadForUser(conversationId, String.valueOf(user.get("ma_tai_khoan")));
    }

    public Conversation requireAccessibleConversation(Map<String, Object> user, String conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new MyAppException(ErrorCode.NOT_FOUND));

        String role = String.valueOf(user.get("loai_tai_khoan"));
        if (AccountType.SINHVIEN.getDbValue().equals(role)) {
            if (!conversation.getStudentId().equals(String.valueOf(user.get("ma_sinh_vien")))) {
                throw new MyAppException(ErrorCode.FORBIDDEN);
            }
            return conversation;
        }
        if (AccountType.COVAN.getDbValue().equals(role)) {
            if (!conversation.getAdvisorId().equals(String.valueOf(user.get("ma_co_van")))) {
                throw new MyAppException(ErrorCode.FORBIDDEN);
            }
            if (!isStudentInAdvisorClass(conversation.getStudentId(), conversation.getAdvisorId())) {
                throw new MyAppException(ErrorCode.FORBIDDEN);
            }
            return conversation;
        }
        throw new MyAppException(ErrorCode.CHAT_INVALID_ROLE);
    }

    private ConversationResponse openStudentConversation(Map<String, Object> user) {
        Map<String, Object> assignment = loadStudentAssignment(String.valueOf(user.get("ma_sinh_vien")));
        String advisorId = valueOrNull(assignment.get("ma_co_van"));
        if (advisorId == null) {
            throw new MyAppException(ErrorCode.CHAT_NO_ADVISOR);
        }

        Conversation conversation = conversationRepository
                .findByStudentIdAndAdvisorId(String.valueOf(user.get("ma_sinh_vien")), advisorId)
                .orElseGet(() -> conversationRepository.save(Conversation.builder()
                        .conversationId(IdGenerator.makeId("HT"))
                        .studentId(String.valueOf(user.get("ma_sinh_vien")))
                        .advisorId(advisorId)
                        .classId(String.valueOf(assignment.get("ma_lop")))
                        .createdAt(LocalDateTime.now())
                        .build()));

        return toConversationResponse(conversation, user);
    }

    private ConversationResponse openAdvisorConversation(Map<String, Object> user, String studentId) {
        if (!isStudentInAdvisorClass(studentId, String.valueOf(user.get("ma_co_van")))) {
            throw new MyAppException(ErrorCode.FORBIDDEN);
        }

        Map<String, Object> assignment = loadStudentAssignment(studentId);
        String advisorId = valueOrNull(assignment.get("ma_co_van"));
        if (advisorId == null || !advisorId.equals(String.valueOf(user.get("ma_co_van")))) {
            throw new MyAppException(ErrorCode.FORBIDDEN);
        }

        Conversation conversation = conversationRepository
                .findByStudentIdAndAdvisorId(studentId, advisorId)
                .orElseGet(() -> conversationRepository.save(Conversation.builder()
                        .conversationId(IdGenerator.makeId("HT"))
                        .studentId(studentId)
                        .advisorId(advisorId)
                        .classId(String.valueOf(assignment.get("ma_lop")))
                        .createdAt(LocalDateTime.now())
                        .build()));

        return toConversationResponse(conversation, user);
    }

    private ConversationResponse toConversationResponse(Conversation conversation, Map<String, Object> user) {
        Map<String, Object> student = loadStudentProfile(conversation.getStudentId());
        Map<String, Object> advisor = loadAdvisorProfile(conversation.getAdvisorId());
        Map<String, Object> classInfo = loadClassProfile(conversation.getClassId());

        List<ChatMessage> latestMessages = chatMessageRepository.findByConversationIdOrderBySentAtDesc(
                conversation.getConversationId(),
                PageRequest.of(0, 1));
        ChatMessageResponse latest = latestMessages.isEmpty()
                ? null
                : toMessageResponse(
                        latestMessages.get(0),
                        loadDisplayName(latestMessages.get(0).getSenderRole(), conversation));

        long unread = chatMessageRepository.countUnreadForUser(
                conversation.getConversationId(),
                String.valueOf(user.get("ma_tai_khoan")));

        return ConversationResponse.builder()
                .maHoiThoai(conversation.getConversationId())
                .maSinhVien(conversation.getStudentId())
                .tenSinhVien(String.valueOf(student.get("ho_va_ten")))
                .maCoVan(conversation.getAdvisorId())
                .tenCoVan(String.valueOf(advisor.get("ho_va_ten")))
                .emailCoVan(valueOrNull(advisor.get("email")))
                .soDienThoaiCoVan(valueOrNull(advisor.get("so_dien_thoai")))
                .chuyenNganhCoVan(valueOrNull(advisor.get("chuyen_nganh")))
                .tenKhoaCoVan(valueOrNull(advisor.get("ten_khoa")))
                .maLop(conversation.getClassId())
                .tenLop(String.valueOf(classInfo.get("ten_lop")))
                .ngayTao(conversation.getCreatedAt())
                .soTinNhanChuaDoc(unread)
                .tinNhanCuoi(latest)
                .build();
    }

    private ChatMessageResponse toMessageResponse(ChatMessage message, String senderName) {
        return ChatMessageResponse.builder()
                .maTinNhan(message.getMessageId())
                .maHoiThoai(message.getConversationId())
                .maNguoiGui(message.getSenderAccountId())
                .loaiNguoiGui(message.getSenderRole())
                .tenNguoiGui(senderName)
                .noiDung(message.getContent())
                .daDoc(Boolean.TRUE.equals(message.getIsRead()))
                .thoiGianGui(message.getSentAt())
                .build();
    }

    private String loadDisplayName(String senderRole, Conversation conversation) {
        if (AccountType.SINHVIEN.getDbValue().equals(senderRole)) {
            return String.valueOf(loadStudentProfile(conversation.getStudentId()).get("ho_va_ten"));
        }
        return String.valueOf(loadAdvisorProfile(conversation.getAdvisorId()).get("ho_va_ten"));
    }

    private Map<String, Object> loadStudentAssignment(String studentId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT sv.ma_sinh_vien, sv.ma_lop, l.ma_co_van
                FROM SINH_VIEN sv
                JOIN LOP l ON l.ma_lop = sv.ma_lop
                WHERE sv.ma_sinh_vien = ?
                """,
                studentId);
        if (rows.isEmpty()) {
            throw new MyAppException(ErrorCode.NOT_FOUND);
        }
        return rows.get(0);
    }

    private Map<String, Object> loadStudentProfile(String studentId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT ma_sinh_vien, ho_va_ten FROM SINH_VIEN WHERE ma_sinh_vien = ?",
                studentId);
        if (rows.isEmpty()) {
            throw new MyAppException(ErrorCode.NOT_FOUND);
        }
        return rows.get(0);
    }

    private Map<String, Object> loadAdvisorProfile(String advisorId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT cv.ma_co_van, cv.ho_va_ten, cv.so_dien_thoai, cv.chuyen_nganh,
                       tk.email, k.ten_khoa
                FROM CVHT cv
                LEFT JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = cv.ma_tai_khoan
                LEFT JOIN KHOA k ON k.ma_khoa = cv.ma_khoa
                WHERE cv.ma_co_van = ?
                """,
                advisorId);
        if (rows.isEmpty()) {
            throw new MyAppException(ErrorCode.NOT_FOUND);
        }
        return rows.get(0);
    }

    private Map<String, Object> loadClassProfile(String classId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT ma_lop, ten_lop FROM LOP WHERE ma_lop = ?",
                classId);
        if (rows.isEmpty()) {
            throw new MyAppException(ErrorCode.NOT_FOUND);
        }
        return rows.get(0);
    }

    private boolean isStudentInAdvisorClass(String studentId, String advisorId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM SINH_VIEN sv
                JOIN LOP l ON l.ma_lop = sv.ma_lop
                WHERE sv.ma_sinh_vien = ?
                  AND l.ma_co_van = ?
                """,
                Integer.class,
                studentId,
                advisorId);
        return count != null && count > 0;
    }

    private String valueOrNull(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value);
        return "null".equals(text) || text.isBlank() ? null : text;
    }
}
