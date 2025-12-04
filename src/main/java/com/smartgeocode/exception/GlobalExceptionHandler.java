package com.smartgeocode.exception;  // smartgeocode with 'o'

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import jakarta.servlet.http.HttpServletRequest;  // Fixed: jakarta.servlet.http for Spring Boot 3.x
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParam(MissingServletRequestParameterException ex, HttpServletRequest request) {
        System.out.println("=== BINDER ERROR: Missing param '" + ex.getParameterName() + "' in query. Full ex: " + ex.getMessage());
        ex.printStackTrace();  // Logs to console/Railway for debug

        Map<String, Object> error = Map.of(
            "status", "error",
            "message", "Missing required param: " + ex.getParameterName() + ". Use ?address=your_query.",
            "timestamp", java.time.Instant.now().toString(),
            "path", request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }
}