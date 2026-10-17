package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class BulkAccountIdsRequest {
    @NotEmpty
    private List<Long> accountIds;
}
