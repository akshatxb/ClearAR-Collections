package com.clearar.collections.collectionsapp.dto;

import lombok.Data;

@Data
public class CreditHoldRequest {
    private boolean creditHold;
    private String reason; // stored in the audit-note communication entry
}
