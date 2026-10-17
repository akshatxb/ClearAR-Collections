package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DisputeRequest {
    @NotBlank
    private String reason;
    private Long invoiceId;
    private Long reasonCodeId;
}
