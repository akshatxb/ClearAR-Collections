package com.clearar.collections.collectionsapp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * P1 #28 -- one row of analyzeFactorAccuracy() output. Compares a factor's typical value
 * ahead of "bad" outcomes (broken PTPs, disputes not resolved as payment_processed) vs.
 * "good" outcomes (kept PTPs, disputes resolved as payment_processed), and suggests a new
 * weight the manager can approve or reject (P1 #29).
 */
@Data
@AllArgsConstructor
public class WeightSuggestion {
    private Long factorId;
    private String factorKey;
    private String label;
    private double currentWeight;
    private double suggestedWeight;
    private String rationale;
    private int goodSampleSize;
    private int badSampleSize;
}
