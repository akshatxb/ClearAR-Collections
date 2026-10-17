package com.clearar.collections.collectionsapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.clearar.collections.collectionsapp.entity.Notification;
import com.clearar.collections.collectionsapp.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * P1 #51 -- notification system (in-app). Simple polling (GET /api/notifications?unread=true
 * every 30s client-side) is sufficient at this scale -- no WebSockets. Other services call
 * {@link #notify} directly (e.g. escalation, co-actor task creation) rather than through a queue.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final ObjectMapper objectMapper;

    public Notification notify(Long userId, String type, Map<String, Object> payload) {
        String json;
        try {
            json = objectMapper.writeValueAsString(payload == null ? Map.of() : payload);
        } catch (Exception e) {
            json = "{}";
        }
        Notification n = Notification.builder()
                .userId(userId)
                .type(type)
                .payload(json)
                .isRead(false)
                .build();
        return notificationRepository.save(n);
    }

    public List<Notification> forUser(Long userId, boolean unreadOnly) {
        return unreadOnly
                ? notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId)
                : notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public Notification markRead(Long notificationId, Long userId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        if (!n.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your notification");
        }
        n.setRead(true);
        return notificationRepository.save(n);
    }
}
