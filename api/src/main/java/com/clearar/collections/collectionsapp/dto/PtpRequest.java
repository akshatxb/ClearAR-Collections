package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PtpRequest {
    @NotNull
    @DecimalMin(value = "0.01", message = "Promised amount must be at least 0.01")
    private BigDecimal promisedAmount;

    @NotNull
    private LocalDate promisedDate;

    private Long invoiceId;
}
