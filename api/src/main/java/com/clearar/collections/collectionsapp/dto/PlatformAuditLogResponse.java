package com.clearar.collections.collectionsapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlatformAuditLogResponse {
    private Long id;
    private Long actorUserId;
    private String actorName;
    private String actorEmail;
    private String action;
    private Long targetOrgId;
    private String targetOrgName;
    private String beforeJson;
    private String afterJson;
    private Instant createdAt;
}
