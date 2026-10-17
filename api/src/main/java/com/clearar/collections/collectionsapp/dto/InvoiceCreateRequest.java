package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class InvoiceCreateRequest {
    @NotNull
    @DecimalMin(value = "0.01", message = "Invoice amount must be at least 0.01")
    private BigDecimal amount;

    @NotNull
    private LocalDate dueDate;

    private LocalDate issuedDate;
}
