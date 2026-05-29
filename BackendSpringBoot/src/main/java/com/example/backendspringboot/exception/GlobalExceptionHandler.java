package com.example.backendspringboot.exception;


import com.example.backendspringboot.dto.response.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    @ExceptionHandler(MyAppException.class)
    public ResponseEntity<ApiResponse<?>> handleMyAppException(MyAppException exception) {
        ErrorCode errorCode = exception.getErrorCode();
        return ResponseEntity
                .status(errorCode.getStatusCode())
                .body(ApiResponse.error(errorCode));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<?>> handleValidationException(MethodArgumentNotValidException exception) {
        return ResponseEntity
                .badRequest()
                .body(ApiResponse.builder()
                        .code(ErrorCode.BAD_REQUEST.getCode())
                        .message(exception.getFieldError() == null
                                ? ErrorCode.BAD_REQUEST.getMessage()
                                : exception.getFieldError().getDefaultMessage())
                        .build());
    }
}
