package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.DisputeRequest;
import com.clearar.collections.collectionsapp.dto.DisputeUpdateRequest;
import com.clearar.collections.collectionsapp.entity.Dispute;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.AccountService;
import com.clearar.collections.collectionsapp.service.DisputeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** P0.4 #17 -- dispute/case creation and tracking. */
@RestController
@RequiredArgsConstructor
public class DisputeController {

    private final DisputeService disputeService;
    private final AccountService accountService;

    @PostMapping("/api/accounts/{accountId}/disputes")
    public Dispute create(@PathVariable Long accountId, @Valid @RequestBody DisputeRequest req) {
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(accountId, orgId, SecurityUtils.currentUser());
        Long userId = SecurityUtils.currentUser().getUserId();
        return disputeService.create(accountId, req.getReason(), userId, false, req.getInvoiceId(), req.getReasonCodeId());
    }

    @GetMapping("/api/accounts/{accountId}/disputes")
    public List<Dispute> forAccount(@PathVariable Long accountId) {
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(accountId, orgId, SecurityUtils.currentUser());
        return disputeService.forAccount(accountId);
    }

    /** Centralized Org-Wide Dispute Management Queue (manager / staff). */
    @GetMapping("/api/disputes")
    public List<java.util.Map<String, Object>> listForOrg() {
        SecurityUtils.requireRole("manager", "collector", "relationship_owner");
        Long orgId = SecurityUtils.requireOrgId();
        java.util.Set<Long> visible = accountService.visibleAccountIds(orgId, SecurityUtils.currentUser());
        List<java.util.Map<String, Object>> rows = disputeService.forOrg(orgId);
        if (visible == null) {
            return rows;
        }
        return rows.stream().filter(r -> visible.contains(r.get("accountId"))).toList();
    }

    /** Resolving requires a reasonCodeId, which also writes an outcome_event (P1 #36). */
    @PatchMapping("/api/disputes/{disputeId}")
    public Dispute update(@PathVariable Long disputeId, @RequestBody DisputeUpdateRequest req) {
        Long orgId = SecurityUtils.requireOrgId(); // must be staff, not customer-scoped
        return disputeService.update(disputeId, req.getStatus(), req.getReasonCodeId(), orgId, SecurityUtils.currentUser());
    }
}
