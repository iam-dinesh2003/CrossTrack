package com.crosstrack.api.service;

import com.crosstrack.api.dto.*;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.UserRepository;
import com.crosstrack.api.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final OtpService otpService;

    @Value("${admin.email:}")
    private String adminEmail;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        // Seed first admin: if email matches ADMIN_EMAIL env var, grant admin role
        String role = (adminEmail != null && !adminEmail.isBlank()
                && adminEmail.equalsIgnoreCase(request.getEmail()))
                ? "ROLE_ADMIN" : "ROLE_USER";

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .displayName(request.getDisplayName() != null ? request.getDisplayName() : request.getEmail().split("@")[0])
                .role(role)
                .build();

        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole());

        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .role(user.getRole())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );
        } catch (BadCredentialsException e) {
            throw new RuntimeException("Invalid email or password");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Auto-promote admin email on every login (handles DB role being stale/null)
        String role = user.getRole();
        if (adminEmail != null && !adminEmail.isBlank()
                && adminEmail.equalsIgnoreCase(user.getEmail())) {
            role = "ROLE_ADMIN";
            if (!"ROLE_ADMIN".equals(user.getRole())) {
                user.setRole("ROLE_ADMIN");
                userRepository.save(user);
            }
        }
        if (role == null) role = "ROLE_USER";

        // Admin requires email OTP as second factor — don't issue token yet
        if ("ROLE_ADMIN".equals(role)) {
            otpService.sendAdminLoginOtp(user.getEmail());
            return AuthResponse.builder()
                    .adminOtpRequired(true)
                    .pendingEmail(user.getEmail())
                    .build();
        }

        String token = jwtUtil.generateToken(user.getEmail(), role);

        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .role(role)
                .build();
    }

    public AuthResponse verifyAdminOtp(String email, String otp) {
        // Verify OTP using existing OtpService logic
        otpService.verifyOtp(email, otp);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Clear OTP after successful admin login verification
        user.setResetOtp(null);
        user.setOtpExpiry(null);
        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole());

        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .role(user.getRole())
                .build();
    }
}
