package com.clearar.collections.collectionsapp.dto;

import lombok.Data;

import java.util.List;

@Data
public class PriorityFactorUpdateRequest {
    private List<Item> factors;

    @Data
    public static class Item {
        private Long id;
        private Double weight;
    }
}
