package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.ManagerSeedRequest;
import com.clearar.collections.collectionsapp.dto.OrgCreateRequest;
import com.clearar.collections.collectionsapp.dto.OrgUpdateRequest;
import com.clearar.collections.collectionsapp.dto.PlatformAuditLogResponse;
import com.clearar.collections.collectionsapp.dto.UserSummary;
import com.clearar.collections.collectionsapp.entity.EmailMessage;
import com.clearar.collections.collectionsapp.entity.Organization;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.EmailService;
import com.clearar.collections.collectionsapp.service.PlatformAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Vendor-side org provisioning and platform management.
 * Gated exclusively to the platform_admin role.
 */
@RestController
@RequestMapping("/api/platform")
@RequiredArgsConstructor
public class PlatformAdminController {

    private final PlatformAdminService platformAdminService;
    private final EmailService emailService;

    /** All emails across all orgs - platform-admin scoped view. */
    @GetMapping("/emails")
    public List<EmailMessage> listAllEmails() {
        SecurityUtils.requireRole("platform_admin");
        return emailService.getAllEmails();
    }

    @GetMapping("/summary")
    public Map<String, Object> getPlatformSummary() {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.getPlatformSummary();
    }

    @GetMapping("/activity")
    public List<PlatformAuditLogResponse> getGlobalActivity() {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.getGlobalActivity();
    }

    @GetMapping("/orgs")
    public List<Organization> listOrgs() {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.list();
    }

    @PostMapping("/orgs")
    public Organization createOrg(@Valid @RequestBody OrgCreateRequest req) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.createOrg(req.getName());
    }

    @GetMapping("/orgs/{id}")
    public Organization getOrg(@PathVariable Long id) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.getOrg(id);
    }

    @PatchMapping("/orgs/{id}")
    public Organization updateOrg(@PathVariable Long id, @Valid @RequestBody OrgUpdateRequest req) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.updateOrg(id, req.getName());
    }

    @PatchMapping("/orgs/{id}/deactivate")
    public Organization deactivateOrg(@PathVariable Long id) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.deactivateOrg(id);
    }

    @PatchMapping("/orgs/{id}/reactivate")
    public Organization reactivateOrg(@PathVariable Long id) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.reactivateOrg(id);
    }

    /** Adds/seeds an org's manager (temp password returned once). */
    @PostMapping("/orgs/{orgId}/managers")
    public Map<String, Object> seedManager(@PathVariable Long orgId, @Valid @RequestBody ManagerSeedRequest req) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.seedManager(orgId, req.getEmail(), req.getName());
    }

    /** Users roster for this organization. */
    @GetMapping("/orgs/{id}/users")
    public List<UserSummary> getOrgUsers(@PathVariable Long id) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.getOrgUsers(id);
    }

    /** Usage rollup summary: users count, accounts count, invoices count, total open balance. */
    @GetMapping("/orgs/{id}/summary")
    public Map<String, Object> getOrgSummary(@PathVariable Long id) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.getOrgSummary(id);
    }

    /** Activity / platform audit log for this organization. */
    @GetMapping("/orgs/{id}/activity")
    public List<PlatformAuditLogResponse> getOrgActivity(@PathVariable Long id) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.getOrgActivity(id);
    }

    /** Temp password recovery for a user in this organization. */
    @PostMapping("/orgs/{orgId}/users/{userId}/reset-password")
    public Map<String, Object> resetUserPassword(@PathVariable Long orgId, @PathVariable Long userId) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.resetUserPassword(orgId, userId);
    }

    /** ---- Platform Admin Team Management ---- */

    @GetMapping("/admins")
    public List<UserSummary> listPlatformAdmins() {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.listPlatformAdmins();
    }

    @PostMapping("/admins")
    public Map<String, Object> createPlatformAdmin(@Valid @RequestBody com.clearar.collections.collectionsapp.dto.PlatformAdminInviteRequest req) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.createPlatformAdmin(req.getEmail(), req.getName());
    }

    @PatchMapping("/admins/{userId}/active")
    public UserSummary setPlatformAdminActive(@PathVariable Long userId, @RequestBody Map<String, Boolean> body) {
        SecurityUtils.requireRole("platform_admin");
        boolean active = Boolean.TRUE.equals(body.get("active"));
        return platformAdminService.setPlatformAdminActive(userId, active);
    }

    @PostMapping("/admins/{userId}/reset-password")
    public Map<String, Object> resetPlatformAdminPassword(@PathVariable Long userId) {
        SecurityUtils.requireRole("platform_admin");
        return platformAdminService.resetPlatformAdminPassword(userId);
    }
}
