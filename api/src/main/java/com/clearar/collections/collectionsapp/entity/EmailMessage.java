package com.clearar.collections.collectionsapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "email_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long orgId;

    private Long accountId;

    @Column(nullable = false)
    private String toEmail;

    private String subject;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String bodyHtml;

    @Column(length = 50)
    @Builder.Default
    private String status = "SENT"; // SENT, FAILED

    @Column(length = 50)
    private String category; // REMINDER, OUTREACH, INVITE, ESCALATION, PAYMENT_RECEIPT, STATEMENT, MANUAL

    @Builder.Default
    private boolean hasAttachment = false;

    private String attachmentName;

    private Long createdBy;

    @Builder.Default
    private Instant createdAt = Instant.now();
}
