package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** P1 #34 -- escalation history log, one row per SLA breach escalated by checkSlaBreaches(). */
@Entity
@Table(name = "escalation_events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EscalationEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long accountId;

    /** Nullable -- an indirect account with no relationship owner still escalates. */
    private Long fromUser;

    @Column(nullable = false)
    private Long toUser;

    @Column(nullable = false)
    private String reason;

    @Builder.Default
    private Instant createdAt = Instant.now();
}
