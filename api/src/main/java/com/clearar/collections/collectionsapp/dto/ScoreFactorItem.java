package com.clearar.collections.collectionsapp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ScoreFactorItem {
    private String factor;
    private double rawValue;
    private double contribution;
    private int direction = 1;

    public ScoreFactorItem(String factor, double rawValue, double contribution) {
        this.factor = factor;
        this.rawValue = rawValue;
        this.contribution = contribution;
        this.direction = contribution < 0 ? -1 : 1;
    }
}
