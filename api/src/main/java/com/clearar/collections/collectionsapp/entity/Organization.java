package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A tenant record. Previously orgId was just a bare Long floating on User/Account/etc with
 * nothing backing its existence -- see HANDOFF_NOTES.md item #1. Created only via
 * PlatformAdminService (platform_admin role), never by staff signup.
 */
@Entity
@Table(name = "organizations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Organization {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Builder.Default
    private boolean active = true;

    @Builder.Default
    private Instant createdAt = Instant.now();
}
