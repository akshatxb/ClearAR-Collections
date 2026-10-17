package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PaymentRequest {
    @NotNull
    @DecimalMin(value = "0.01", message = "Payment amount must be at least 0.01")
    private BigDecimal amount;

    private LocalDate paidDate; // defaults to today if omitted

    private String method; // e.g. ach, card, check, wire
}
