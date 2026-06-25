package com.example.backendspringboot.controller;

import com.example.backendspringboot.dto.request.ChatSocketMessageRequest;
import com.example.backendspringboot.dto.request.SendChatMessageRequest;
import com.example.backendspringboot.dto.response.ChatMessageResponse;
import com.example.backendspringboot.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.send")
    public void sendMessage(ChatSocketMessageRequest request, SimpMessageHeaderAccessor headerAccessor) {
        Map<String, Object> sessionAttributes = headerAccessor.getSessionAttributes();
        if (sessionAttributes == null || sessionAttributes.get("chatUser") == null) {
            return;
        }

        Map<String, Object> user = (Map<String, Object>) sessionAttributes.get("chatUser");
        SendChatMessageRequest payload = new SendChatMessageRequest();
        payload.setNoiDung(request.getNoiDung());

        ChatMessageResponse response = chatService.sendMessage(user, request.getMaHoiThoai(), payload);
        messagingTemplate.convertAndSend("/topic/chat/" + request.getMaHoiThoai(), response);
    }
}
