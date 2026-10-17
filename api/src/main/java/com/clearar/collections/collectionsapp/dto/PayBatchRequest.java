package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/** Batch payment request for multiple invoices. */
@Data
public class PayBatchRequest {
    @NotEmpty
    private List<Long> invoiceIds;
}
