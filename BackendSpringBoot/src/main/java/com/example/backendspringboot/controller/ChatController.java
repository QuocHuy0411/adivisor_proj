package com.example.backendspringboot.controller;

import com.example.backendspringboot.dto.request.OpenConversationRequest;
import com.example.backendspringboot.dto.request.SendChatMessageRequest;
import com.example.backendspringboot.dto.response.ChatMessageResponse;
import com.example.backendspringboot.dto.response.ConversationResponse;
import com.example.backendspringboot.service.ChatService;
import com.example.backendspringboot.service.CurrentUserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final CurrentUserService currentUserService;

    @GetMapping("/conversations")
    public List<ConversationResponse> listConversations(HttpServletRequest request) {
        Map<String, Object> user = currentUserService.requireUser(request);
        return chatService.listConversations(user);
    }

    @PostMapping("/conversations")
    public ConversationResponse openConversation(HttpServletRequest request,
                                                 @RequestBody(required = false) OpenConversationRequest body) {
        Map<String, Object> user = currentUserService.requireUser(request);
        return chatService.openConversation(user, body);
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public List<ChatMessageResponse> getMessages(HttpServletRequest request,
                                               @PathVariable String conversationId,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "50") int size) {
        Map<String, Object> user = currentUserService.requireUser(request);
        return chatService.getMessages(user, conversationId, page, size);
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public ChatMessageResponse sendMessage(HttpServletRequest request,
                                           @PathVariable String conversationId,
                                           @Valid @RequestBody SendChatMessageRequest body) {
        Map<String, Object> user = currentUserService.requireUser(request);
        return chatService.sendMessage(user, conversationId, body);
    }

    @PostMapping("/conversations/{conversationId}/read")
    public Map<String, String> markAsRead(HttpServletRequest request,
                                          @PathVariable String conversationId) {
        Map<String, Object> user = currentUserService.requireUser(request);
        chatService.markAsRead(user, conversationId);
        return Map.of("message", "Da danh dau da doc");
    }
}
