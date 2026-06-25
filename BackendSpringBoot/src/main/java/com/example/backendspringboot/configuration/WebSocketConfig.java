package com.example.backendspringboot.configuration;

import com.example.backendspringboot.service.ChatService;
import com.example.backendspringboot.service.CurrentUserService;
import com.example.backendspringboot.util.CookieUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final CurrentUserService currentUserService;
    private final ChatService chatService;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Override
    public void configureMessageBroker(org.springframework.messaging.simp.config.MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .addInterceptors(jwtHandshakeInterceptor())
                .setAllowedOrigins(frontendUrl)
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(org.springframework.messaging.simp.config.ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor());
    }

    private HandshakeInterceptor jwtHandshakeInterceptor() {
        return new HandshakeInterceptor() {
            @Override
            public boolean beforeHandshake(ServerHttpRequest request,
                                           ServerHttpResponse response,
                                           WebSocketHandler wsHandler,
                                           Map<String, Object> attributes) {
                if (!(request instanceof ServletServerHttpRequest servletRequest)) {
                    return false;
                }
                HttpServletRequest httpRequest = servletRequest.getServletRequest();
                String accessToken = CookieUtil.readCookie(httpRequest, "accessToken");
                Map<String, Object> user = currentUserService.requireUser(accessToken);
                attributes.put("chatUser", user);
                return true;
            }

            @Override
            public void afterHandshake(ServerHttpRequest request,
                                       ServerHttpResponse response,
                                       WebSocketHandler wsHandler,
                                       Exception exception) {
            }
        };
    }

    private ChannelInterceptor stompAuthChannelInterceptor() {
        return new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null) {
                    return message;
                }

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
                    if (sessionAttributes == null || sessionAttributes.get("chatUser") == null) {
                        throw new IllegalArgumentException("Chua xac thuc WebSocket");
                    }
                    Map<String, Object> user = (Map<String, Object>) sessionAttributes.get("chatUser");
                    accessor.setUser(() -> String.valueOf(user.get("ma_tai_khoan")));
                }

                if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    String destination = accessor.getDestination();
                    if (destination != null && destination.startsWith("/topic/chat/")) {
                        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
                        if (sessionAttributes == null || sessionAttributes.get("chatUser") == null) {
                            throw new IllegalArgumentException("Chua xac thuc WebSocket");
                        }
                        Map<String, Object> user = (Map<String, Object>) sessionAttributes.get("chatUser");
                        String conversationId = destination.substring("/topic/chat/".length());
                        chatService.requireAccessibleConversation(user, conversationId);
                    }
                }
                return message;
            }
        };
    }
}
