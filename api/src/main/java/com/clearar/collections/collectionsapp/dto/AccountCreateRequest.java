package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AccountCreateRequest {
    @NotBlank
    private String name;

    private String contactEmail;
    private String contactPhone;
    private String creditTerms;

    @NotBlank
    private String ownershipMode; // direct | indirect

    private Long relationshipOwnerId; // required if ownershipMode = indirect
    private Long assignedCollectorId;
}
