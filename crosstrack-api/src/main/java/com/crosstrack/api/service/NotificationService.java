package com.crosstrack.api.service;

import com.crosstrack.api.dto.ApplicationResponse;
import com.crosstrack.api.model.Application;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    public void sendGhostNotification(Long userId, Application app) {
        Map<String, Object> message = Map.of(
                "type", "GHOST_RESOLVED",
                "application", ApplicationResponse.fromEntity(app),
                "timestamp", LocalDateTime.now().toString()
        );
        messagingTemplate.convertAndSend("/queue/notifications-" + userId, message);
    }

    public void sendStatusUpdate(Long userId, Application app) {
        Map<String, Object> message = Map.of(
                "type", "STATUS_UPDATED",
                "application", ApplicationResponse.fromEntity(app),
                "timestamp", LocalDateTime.now().toString()
        );
        messagingTemplate.convertAndSend("/queue/notifications-" + userId, message);
    }
}
