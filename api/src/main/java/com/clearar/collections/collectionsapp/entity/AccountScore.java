package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "account_scores")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AccountScore {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long accountId;

    @Column(nullable = false)
    private Double totalScore;

    @Lob
    @Column(nullable = false, columnDefinition = "MEDIUMTEXT")
    private String breakdownJson;

    @Builder.Default
    private Instant computedAt = Instant.now();
}
