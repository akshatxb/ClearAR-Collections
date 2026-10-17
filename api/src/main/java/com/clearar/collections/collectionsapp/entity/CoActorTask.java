package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "co_actor_tasks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CoActorTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long accountId;

    @Column(nullable = false)
    private Long assignedTo;

    private Long requestedBy;

    @Column(nullable = false)
    private String requestType;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String notes;

    @Builder.Default
    private String status = "pending";

    @Lob
    @Column(columnDefinition = "TEXT")
    private String outcomeNotes;

    @Builder.Default
    private Instant createdAt = Instant.now();
}
