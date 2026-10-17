package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class BulkReassignRequest {
    @NotEmpty
    private List<Long> accountIds;

    @NotNull
    private Long relationshipOwnerId;
}
