package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class BulkAssignCollectorRequest {
    @NotEmpty
    private List<Long> accountIds;

    // Nullable if unassigning
    private Long collectorId;
}
