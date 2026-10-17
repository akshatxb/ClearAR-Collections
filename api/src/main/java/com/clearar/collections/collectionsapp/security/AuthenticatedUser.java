package com.clearar.collections.collectionsapp.security;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Represents the identity + scope extracted from the JWT for the current request.
 * Controllers/services pull org_id / accountId from here -- never from client input.
 */
@Getter
@AllArgsConstructor
public class AuthenticatedUser {
    private final Long userId;
    private final String email;
    private final String role;
    private final Long orgId;     // null for customer-scoped tokens
    private final Long accountId; // set only for customer-scoped tokens

    public boolean hasRole(String... roles) {
        for (String r : roles) {
            if (r.equals(role)) return true;
        }
        return false;
    }
}
