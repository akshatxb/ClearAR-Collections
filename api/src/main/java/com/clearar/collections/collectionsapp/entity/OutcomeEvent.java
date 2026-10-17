package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "outcome_events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OutcomeEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long accountId;

    @Column(nullable = false)
    private String eventType;

    private Long reasonCodeId;

    private Long sourceId;

    @Lob
    @Column(columnDefinition = "MEDIUMTEXT")
    private String factorSnapshotJson;

    @Builder.Default
    private Instant createdAt = Instant.now();
}
