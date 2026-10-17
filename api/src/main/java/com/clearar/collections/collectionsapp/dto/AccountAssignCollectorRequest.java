package com.clearar.collections.collectionsapp.dto;

import lombok.Data;

@Data
public class AccountAssignCollectorRequest {
    // Nullable if unassigning
    private Long collectorId;
}
