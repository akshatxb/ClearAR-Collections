package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** P1 #51 -- notification system (in-app). Simple polling model, no WebSockets at this scale. */
@Entity
@Table(name = "notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String type;

    @Lob
    @Column(columnDefinition = "MEDIUMTEXT")
    private String payload; // JSON string

    @Builder.Default
    private boolean isRead = false;

    @Builder.Default
    private Instant createdAt = Instant.now();
}
