package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * P1 #32 -- SLA-based escalation engine. A rule fires when an account's worst aging bucket
 * reaches {@code agingBucket} (or worse) and escalates to the first active user in the org
 * holding {@code escalateToRole}.
 */
@Entity
@Table(name = "escalation_rules")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EscalationRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long orgId;

    /** Minimum aging bucket that trips this rule: "0-30" | "31-60" | "61-90" | "90+". */
    @Column(nullable = false)
    private String agingBucket;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role escalateToRole;

    @Builder.Default
    private boolean active = true;
}
