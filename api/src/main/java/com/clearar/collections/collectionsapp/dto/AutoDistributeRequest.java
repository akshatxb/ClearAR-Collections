package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class AutoDistributeRequest {
    // If empty or null, distribute all unassigned accounts in org
    private List<Long> accountIds;

    // The collector user IDs to distribute across (must have collector/manager role)
    @NotEmpty
    private List<Long> collectorIds;

    // Strategy: "round_robin" (default) or "balanced_balance"
    private String strategy;
}
