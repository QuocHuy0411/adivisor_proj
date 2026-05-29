package com.example.backendspringboot.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();

        // Đăng ký module hỗ trợ Java 8 Date/Time (LocalDate, LocalDateTime,...)
        mapper.registerModule(new JavaTimeModule());

        // Tắt tính năng convert ngày tháng thành số (timestamp),
        // ép nó convert thành chuỗi String dạng ISO-8601 dễ đọc ("2005-01-17")
//        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        return mapper;
    }
}