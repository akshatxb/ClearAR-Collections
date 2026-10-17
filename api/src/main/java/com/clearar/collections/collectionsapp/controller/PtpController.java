package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.PtpRequest;
import com.clearar.collections.collectionsapp.entity.Ptp;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.AccountService;
import com.clearar.collections.collectionsapp.service.PtpService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** P0.4 #16 -- Promise-to-Pay creation & tracking. */
@RestController
@RequiredArgsConstructor
public class PtpController {

    private final PtpService ptpService;
    private final AccountService accountService;

    @PostMapping("/api/accounts/{accountId}/ptp")
    public Ptp create(@PathVariable Long accountId, @Valid @RequestBody PtpRequest req) {
        com.clearar.collections.collectionsapp.security.AuthenticatedUser user = SecurityUtils.currentUser();
        Long orgId = user.getOrgId();
        if (orgId != null) {
            accountService.getScopedForUser(accountId, orgId, user);
        }
        Long userId = user.getUserId();
        return ptpService.create(accountId, req.getPromisedAmount(), req.getPromisedDate(), userId, req.getInvoiceId());
    }

    @GetMapping("/api/accounts/{accountId}/ptp")
    public List<Ptp> forAccount(@PathVariable Long accountId) {
        com.clearar.collections.collectionsapp.security.AuthenticatedUser user = SecurityUtils.currentUser();
        Long orgId = user.getOrgId();
        if (orgId != null) {
            accountService.getScopedForUser(accountId, orgId, user);
        }
        return ptpService.forAccount(accountId);
    }

    @GetMapping("/api/ptp")
    public List<java.util.Map<String, Object>> forOrg() {
        com.clearar.collections.collectionsapp.security.AuthenticatedUser user = SecurityUtils.currentUser();
        Long orgId = user.getOrgId();
        if (orgId == null) {
            return ptpService.forAllOrgs();
        }
        java.util.Set<Long> visible = accountService.visibleAccountIds(orgId, user);
        List<java.util.Map<String, Object>> rows = ptpService.forOrg(orgId);
        if (visible == null) {
            return rows;
        }
        return rows.stream().filter(r -> visible.contains(r.get("accountId"))).toList();
    }

    @PatchMapping("/api/ptp/{id}")
    public Ptp updateStatus(@PathVariable Long id, @RequestBody java.util.Map<String, String> body) {
        com.clearar.collections.collectionsapp.security.AuthenticatedUser user = SecurityUtils.currentUser();
        Long orgId = user.getOrgId();
        String statusStr = body.get("status");
        if (statusStr == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "status is required");
        }
        com.clearar.collections.collectionsapp.entity.PtpStatus status;
        try {
            status = com.clearar.collections.collectionsapp.entity.PtpStatus.valueOf(statusStr.toLowerCase());
        } catch (IllegalArgumentException e) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid status: " + statusStr + ". Allowed: pending, kept, broken");
        }
        return ptpService.updateStatus(id, status, orgId, user.getRole(), user.getUserId());
    }

    /** P1 #35 groundwork / manual-trigger sweep instead of a real cron, per hackathon spec guidance. */
    @PostMapping("/api/admin/run-ptp-sweep")
    public List<Ptp> sweep() {
        SecurityUtils.requireRole("manager", "platform_admin");
        com.clearar.collections.collectionsapp.security.AuthenticatedUser user = SecurityUtils.currentUser();
        Long orgId = user.getOrgId();
        if (orgId == null) {
            return ptpService.sweepOverdue();
        }
        return ptpService.sweepOverdue(orgId);
    }
}
