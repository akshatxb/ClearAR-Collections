package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class BulkOwnershipModeRequest {
    @NotEmpty
    private List<Long> accountIds;

    @NotBlank
    private String ownershipMode; // direct | indirect

    private Long relationshipOwnerId; // required if ownershipMode = indirect
}
