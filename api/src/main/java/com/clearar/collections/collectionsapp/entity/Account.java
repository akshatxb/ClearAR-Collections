package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "accounts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Account {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long orgId;

    @Column(nullable = false)
    private String name;

    private String contactEmail;
    private String contactPhone;
    private String creditTerms;

    @Column(nullable = false)
    private String ownershipMode;

    private Long relationshipOwnerId;
    private Long assignedCollectorId;

    @Builder.Default
    private boolean creditHold = false;

    private java.math.BigDecimal creditLimit;

    private String riskTier;

    @Builder.Default
    private Instant createdAt = Instant.now();
}
