package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.entity.Notification;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** P1 #51 -- notification system (in-app). Polling model: GET ?unread=true every 30s client-side. */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public List<Notification> list(@RequestParam(required = false, defaultValue = "false") boolean unread) {
        Long userId = SecurityUtils.currentUser().getUserId();
        return notificationService.forUser(userId, unread);
    }

    @PatchMapping("/{id}/read")
    public Notification markRead(@PathVariable Long id) {
        Long userId = SecurityUtils.currentUser().getUserId();
        return notificationService.markRead(id, userId);
    }
}
