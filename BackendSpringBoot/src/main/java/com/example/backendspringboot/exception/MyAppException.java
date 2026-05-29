package com.example.backendspringboot.exception;

public class MyAppException extends RuntimeException {
    private ErrorCode errorCode;
    public MyAppException(ErrorCode errorCode){
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(ErrorCode errorCode) {
        this.errorCode = errorCode;
    }
}