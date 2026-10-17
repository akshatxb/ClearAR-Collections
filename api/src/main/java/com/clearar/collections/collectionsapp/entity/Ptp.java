package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "ptps")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Ptp {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long accountId;

    @Column(nullable = false)
    private BigDecimal promisedAmount;

    @Column(nullable = false)
    private LocalDate promisedDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private PtpStatus status = PtpStatus.pending;

    private Long invoiceId;

    private Long createdBy;

    @Builder.Default
    private java.time.Instant createdAt = java.time.Instant.now();
}
