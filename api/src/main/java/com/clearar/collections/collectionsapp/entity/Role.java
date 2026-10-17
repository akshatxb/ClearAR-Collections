package com.clearar.collections.collectionsapp.entity;

public enum Role {
    /**
     * Vendor-side, platform-level actor. NOT org-scoped (no orgId claim on its JWT at all --
     * a third token shape alongside the existing org-scoped staff tokens and customer-scoped
     * tokens). Can create organizations and seed each org's first manager. Cannot be created
     * via /auth/signup or /api/users/invite -- see PlatformAdminController / SeedService.
     */
    platform_admin,
    manager, collector, relationship_owner, customer
}
