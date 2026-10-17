package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "reason_codes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ReasonCode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long orgId;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private String label;
}
