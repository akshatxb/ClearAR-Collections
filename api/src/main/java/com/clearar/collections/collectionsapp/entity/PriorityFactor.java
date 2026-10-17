package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "priority_factors")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PriorityFactor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long orgId;

    @Column(nullable = false)
    private String factorKey;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false)
    private Double weight;

    @Builder.Default
    private boolean active = true;

    /**
     * Direction of the factor:
     * +1 = Risk / penalty factor (increases priority score / urgency)
     * -1 = Mitigating / relief factor (decreases priority score / urgency)
     */
    @Builder.Default
    @Column(nullable = false)
    private Integer direction = 1;

    public int getEffectiveDirection() {
        return direction != null && direction < 0 ? -1 : 1;
    }
}
