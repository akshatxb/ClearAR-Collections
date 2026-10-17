package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.ChangePasswordRequest;
import com.clearar.collections.collectionsapp.dto.ProfileUpdateRequest;
import com.clearar.collections.collectionsapp.dto.UserActiveUpdateRequest;
import com.clearar.collections.collectionsapp.dto.UserInviteRequest;
import com.clearar.collections.collectionsapp.dto.UserRoleUpdateRequest;
import com.clearar.collections.collectionsapp.dto.UserSummary;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.UserManagementService;
import com.clearar.collections.collectionsapp.service.UserStatsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** P1 #40 -- personal performance dashboard (collector). P1 #47 -- user management (admin). */
@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserStatsService userStatsService;
    private final UserManagementService userManagementService;

    @GetMapping("/api/users/me/stats")
    public Map<String, Object> myStats() {
        Long userId = SecurityUtils.currentUser().getUserId();
        Long orgId = SecurityUtils.requireOrgId();
        return userStatsService.myStats(userId, orgId);
    }

    /** Self-service: update the authenticated user's own display name. */
    @PatchMapping("/api/users/me")
    public Map<String, Object> updateMyProfile(@Valid @RequestBody ProfileUpdateRequest req) {
        Long userId = SecurityUtils.currentUser().getUserId();
        return userManagementService.updateProfile(userId, req.getName());
    }

    /** Self-service: change the authenticated user's own password. */
    @PostMapping("/api/users/me/change-password")
    public ResponseEntity<Void> changeMyPassword(@Valid @RequestBody ChangePasswordRequest req) {
        Long userId = SecurityUtils.currentUser().getUserId();
        userManagementService.changePassword(userId, req.getCurrentPassword(), req.getNewPassword());
        return ResponseEntity.ok().build();
    }

    /** P1 #47 -- list staff users in the org. Available to all internal staff. */
    @GetMapping("/api/users")
    public List<UserSummary> list() {
        SecurityUtils.requireRole("manager", "collector", "relationship_owner");
        Long orgId = SecurityUtils.requireOrgId();
        return userManagementService.list(orgId);
    }

    /** P1 #47 -- invite: create with a temp password, returned once in the response. Manager-only. */
    @PostMapping("/api/users/invite")
    public Map<String, Object> invite(@Valid @RequestBody UserInviteRequest req) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        return userManagementService.invite(orgId, req.getEmail(), req.getName(), req.getRole());
    }

    /** P1 #47 -- role assignment. Manager-only. */
    @PatchMapping("/api/users/{id}/role")
    public UserSummary updateRole(@PathVariable Long id, @Valid @RequestBody UserRoleUpdateRequest req) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        Long callingUserId = SecurityUtils.currentUser().getUserId();
        return userManagementService.updateRole(id, orgId, req.getRole(), callingUserId);
    }

    /** P1 #47 -- deactivate/reactivate (active BOOLEAN flag, never a hard delete). Manager-only. */
    @PatchMapping("/api/users/{id}/active")
    public UserSummary setActive(@PathVariable Long id, @RequestBody UserActiveUpdateRequest req) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        Long callingUserId = SecurityUtils.currentUser().getUserId();
        return userManagementService.setActive(id, orgId, req.isActive(), callingUserId);
    }
}
