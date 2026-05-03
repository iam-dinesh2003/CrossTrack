package com.crosstrack.api.service;

import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private final UserRepository userRepository;
    private final JavaMailSender mailSender;
    private final PasswordEncoder passwordEncoder;

    @Value("${crosstrack.otp.expiry-minutes:10}")
    private int otpExpiryMinutes;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Generate a 6-digit OTP, save it to the user, and send via email.
     */
    public Map<String, String> sendOtp(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("No account found with this email"));

        // If email not configured, fail loudly — never expose OTP in API response
        if (fromEmail == null || fromEmail.isBlank()) {
            log.warn("╔══════════════════════════════════════════════════════╗");
            log.warn("║  [OTP] Email not configured — cannot send OTP        ║");
            log.warn("║  Set MAIL_USERNAME and MAIL_PASSWORD in start-local  ║");
            log.warn("╚══════════════════════════════════════════════════════╝");
            throw new RuntimeException("Email service not configured. Please set MAIL_USERNAME and MAIL_PASSWORD.");
        }

        // Generate 6-digit OTP
        String otp = String.format("%06d", RANDOM.nextInt(1000000));

        // Save OTP with expiry
        user.setResetOtp(otp);
        user.setOtpExpiry(LocalDateTime.now().plusMinutes(otpExpiryMinutes));
        userRepository.save(user);

        // Send email
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(email);
            message.setSubject("CrossTrack - Password Reset Code");
            message.setText(
                    "Hi " + (user.getDisplayName() != null ? user.getDisplayName() : "there") + ",\n\n" +
                    "Your password reset code is: " + otp + "\n\n" +
                    "This code expires in " + otpExpiryMinutes + " minutes.\n\n" +
                    "If you didn't request this, you can safely ignore this email.\n\n" +
                    "— CrossTrack"
            );
            mailSender.send(message);
            log.info("[OTP] Sent password reset OTP to {}", email);
        } catch (Exception e) {
            log.error("[OTP] Failed to send email to {}: {}", email, e.getMessage());
            throw new RuntimeException("Failed to send OTP email. Please try again.");
        }

        return Map.of("message", "OTP sent to " + maskEmail(email));
    }

    /**
     * Generate a 6-digit OTP for admin login 2FA and send via email.
     */
    public void sendAdminLoginOtp(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("No account found with this email"));

        if (fromEmail == null || fromEmail.isBlank()) {
            throw new RuntimeException("Email service not configured. Please set MAIL_USERNAME and MAIL_PASSWORD.");
        }

        String otp = String.format("%06d", RANDOM.nextInt(1000000));

        user.setResetOtp(otp);
        user.setOtpExpiry(LocalDateTime.now().plusMinutes(otpExpiryMinutes));
        userRepository.save(user);

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(email);
            message.setSubject("CrossTrack Admin — Login Verification");
            message.setText(
                    "Hi " + (user.getDisplayName() != null ? user.getDisplayName() : "Admin") + ",\n\n" +
                    "Someone is attempting to log in to the CrossTrack admin panel.\n\n" +
                    "Your verification code is: " + otp + "\n\n" +
                    "This code expires in " + otpExpiryMinutes + " minutes.\n\n" +
                    "If this wasn't you, your account may be compromised — change your password immediately.\n\n" +
                    "— CrossTrack"
            );
            mailSender.send(message);
            log.info("[ADMIN-OTP] Sent admin login OTP to {}", email);
        } catch (Exception e) {
            log.error("[ADMIN-OTP] Failed to send admin login OTP to {}: {}", email, e.getMessage());
            throw new RuntimeException("Failed to send verification email. Please try again.");
        }
    }

    /**
     * Verify the OTP code.
     */
    public Map<String, Object> verifyOtp(String email, String otp) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("No account found with this email"));

        if (user.getResetOtp() == null || user.getOtpExpiry() == null) {
            throw new RuntimeException("No OTP requested. Please request a new code.");
        }

        if (LocalDateTime.now().isAfter(user.getOtpExpiry())) {
            user.setResetOtp(null);
            user.setOtpExpiry(null);
            userRepository.save(user);
            throw new RuntimeException("OTP expired. Please request a new code.");
        }

        if (!user.getResetOtp().equals(otp)) {
            throw new RuntimeException("Invalid OTP. Please try again.");
        }

        log.info("[OTP] Verified OTP for {}", email);
        return Map.of("message", "OTP verified", "verified", true);
    }

    /**
     * Reset password after OTP verification.
     */
    public Map<String, String> resetPassword(String email, String otp, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("No account found with this email"));

        // Re-verify OTP
        if (user.getResetOtp() == null || !user.getResetOtp().equals(otp)) {
            throw new RuntimeException("Invalid OTP. Please start over.");
        }

        if (LocalDateTime.now().isAfter(user.getOtpExpiry())) {
            throw new RuntimeException("OTP expired. Please request a new code.");
        }

        if (newPassword == null || newPassword.length() < 6) {
            throw new RuntimeException("Password must be at least 6 characters.");
        }

        // Update password and clear OTP
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setResetOtp(null);
        user.setOtpExpiry(null);
        userRepository.save(user);

        log.info("[OTP] Password reset successful for {}", email);
        return Map.of("message", "Password reset successful. You can now log in.");
    }

    private String maskEmail(String email) {
        int atIndex = email.indexOf('@');
        if (atIndex <= 2) return email;
        return email.charAt(0) + "***" + email.substring(atIndex - 1);
    }
}
