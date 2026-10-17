package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ManagerSeedRequest {
    @Email @NotBlank
    private String email;

    private String name;
}
