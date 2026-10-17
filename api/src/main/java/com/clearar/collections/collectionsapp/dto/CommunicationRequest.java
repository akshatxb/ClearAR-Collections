package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CommunicationRequest {
    @NotBlank
    private String type; // email | call | note

    private String content;

    private Integer durationSeconds;
}
