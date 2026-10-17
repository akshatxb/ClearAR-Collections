package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "communications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Communication {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long accountId;

    @Column(nullable = false)
    private String type;

    @Lob
    @Column(columnDefinition = "MEDIUMTEXT")
    private String content;

    private Long createdBy;

    private Integer durationSeconds;

    @Transient
    private String createdByName;

    @Builder.Default
    private Instant createdAt = Instant.now();
}
