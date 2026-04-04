package com.crosstrack.api.controller;

import com.crosstrack.api.dto.DuplicateCheckRequest;
import com.crosstrack.api.dto.DuplicateCheckResponse;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.UserRepository;
import com.crosstrack.api.service.DuplicateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/duplicates")
@RequiredArgsConstructor
public class DuplicateController {

    private final DuplicateService duplicateService;
    private final UserRepository userRepository;

    @PostMapping("/check")
    public ResponseEntity<DuplicateCheckResponse> check(Authentication auth,
                                                         @Valid @RequestBody DuplicateCheckRequest request) {
        User user = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(duplicateService.checkDuplicate(user.getId(), request.getCompany(), request.getRole()));
    }
}
