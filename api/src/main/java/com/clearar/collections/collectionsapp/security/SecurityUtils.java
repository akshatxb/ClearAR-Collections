package com.clearar.collections.collectionsapp.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

public class SecurityUtils {

    private SecurityUtils() {}

    public static AuthenticatedUser currentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getPrincipal()
                : null;
        if (!(principal instanceof AuthenticatedUser user)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        return user;
    }

    /** requireRole(['manager']) equivalent -- 403s if the caller's role isn't in the allowed set. */
    public static void requireRole(String... allowedRoles) {
        AuthenticatedUser user = currentUser();
        if (!user.hasRole(allowedRoles)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires role: " + String.join(",", allowedRoles));
        }
    }

    /** For org-scoped (non-customer) roles: returns req.user.org_id, never trusting client input. */
    public static Long requireOrgId() {
        AuthenticatedUser user = currentUser();
        if (user.getOrgId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No org scope on this token");
        }
        return user.getOrgId();
    }

    /** For customer-scoped tokens: returns req.user.account_id. */
    public static Long requireCustomerAccountId() {
        AuthenticatedUser user = currentUser();
        if (user.getAccountId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a customer-scoped token");
        }
        return user.getAccountId();
    }
}
