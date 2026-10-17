package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** Request body for PATCH /api/users/me (update display name). */
@Getter
@Setter
public class ProfileUpdateRequest {

    @NotBlank(message = "Name must not be blank")
    @Size(max = 120, message = "Name must be at most 120 characters")
    private String name;
}
