package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "platform_audit_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlatformAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long actorUserId;

    @Column(nullable = false)
    private String action;

    @Column(nullable = false)
    private Long targetOrgId;

    @Column(columnDefinition = "TEXT")
    private String beforeJson;

    @Column(columnDefinition = "TEXT")
    private String afterJson;

    @Builder.Default
    private Instant createdAt = Instant.now();
}
