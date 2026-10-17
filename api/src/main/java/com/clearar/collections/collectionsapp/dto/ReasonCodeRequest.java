package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReasonCodeRequest {
    @NotBlank
    private String category;

    @NotBlank
    private String code;

    @NotBlank
    private String label;
}
