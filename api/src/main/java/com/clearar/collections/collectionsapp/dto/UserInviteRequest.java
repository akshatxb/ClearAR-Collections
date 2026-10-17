package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UserInviteRequest {
    @Email @NotBlank
    private String email;

    private String name;

    @NotBlank
    private String role; // manager | collector | relationship_owner (customer accounts are self-signup, not invited)
}
