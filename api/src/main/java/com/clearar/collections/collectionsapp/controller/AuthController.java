package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.AuthResponse;
import com.clearar.collections.collectionsapp.dto.ForgotPasswordRequest;
import com.clearar.collections.collectionsapp.dto.LoginRequest;
import com.clearar.collections.collectionsapp.dto.SignupRequest;
import com.clearar.collections.collectionsapp.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public AuthResponse signup(@Valid @RequestBody SignupRequest req) {
        return authService.signup(req);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    @PostMapping("/forgot-password")
    public Map<String, String> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        return authService.forgotPassword(req.getEmail());
    }
}
