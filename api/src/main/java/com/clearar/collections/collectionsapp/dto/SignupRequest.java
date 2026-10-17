package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * HANDOFF_NOTES.md item #1 -- customer self-signup only. Staff roles are no longer accepted
 * here (see AuthService.signup()); they're created via platform-admin org provisioning
 * (an org's first manager) or manager-gated /api/users/invite (everyone after that).
 */
@Data
public class SignupRequest {
    @Email @NotBlank
    private String email;

    @NotBlank
    private String password;

    private String name;

    @NotNull
    private Long accountId;
}
