package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/** P1 #41 -- customer picks one invoice to pay via Stripe test mode (or custom partial amount). */
@Data
public class PayRequest {
    @NotNull
    private Long invoiceId;

    private BigDecimal amount;
}
