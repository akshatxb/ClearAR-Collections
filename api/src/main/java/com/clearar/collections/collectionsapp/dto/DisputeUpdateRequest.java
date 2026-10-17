package com.clearar.collections.collectionsapp.dto;

import lombok.Data;

@Data
public class DisputeUpdateRequest {
    private String status; // open | investigating | resolved
    private Long reasonCodeId; // required when status = resolved
}
