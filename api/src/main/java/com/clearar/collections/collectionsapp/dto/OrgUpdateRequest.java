package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OrgUpdateRequest {
    @NotBlank(message = "Organization name is required")
    private String name;
}
