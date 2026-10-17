package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.AccountCreateRequest;
import com.clearar.collections.collectionsapp.dto.BulkOwnershipModeRequest;
import com.clearar.collections.collectionsapp.dto.CreditHoldRequest;
import com.clearar.collections.collectionsapp.dto.ScoreFactorItem;
import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.AccountService;
import com.clearar.collections.collectionsapp.service.CommunicationService;
import com.clearar.collections.collectionsapp.service.ImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * P0.2 #4 (create), P0.3 #11 (worklist), P0.4 #12 (detail), P0.2 #7 (aging), P0.3 #9 (score breakdown),
 * P0.6 #20 (dual-mode outreach routing), P1 #43 (CSV import), P1 #45 (credit-hold), P1 #48 (bulk ownership override).
 */
@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;
    private final CommunicationService communicationService;
    private final ImportService importService;

    /** P0.2 #4 -- customer/account master record. */
    @PostMapping
    public Account create(@Valid @RequestBody AccountCreateRequest req) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        return accountService.create(orgId, req.getName(), req.getContactEmail(), req.getContactPhone(),
                req.getCreditTerms(), req.getOwnershipMode(), req.getRelationshipOwnerId(), req.getAssignedCollectorId());
    }

    /** GET /api/accounts?sort=priority_score DESC&agingBucket=&ownershipMode=&assignedTo=&collectorId=&unassigned= */
    @GetMapping
    public List<Map<String, Object>> worklist(
            @RequestParam(required = false) String agingBucket,
            @RequestParam(required = false) String ownershipMode,
            @RequestParam(required = false) Long assignedTo,
            @RequestParam(required = false) Long collectorId,
            @RequestParam(required = false) Boolean unassigned) {
        var user = SecurityUtils.currentUser();
        Long orgId = SecurityUtils.requireOrgId();

        // Enforce role-based portfolio scoping:
        // Collectors can ONLY see their own assigned accounts. Only managers get to see all accounts.
        if ("collector".equalsIgnoreCase(user.getRole())) {
            collectorId = user.getUserId();
            assignedTo = null;
            unassigned = false;
        }

        return accountService.worklist(orgId, agingBucket, ownershipMode, assignedTo, collectorId, unassigned);
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable Long id) {
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(id, orgId, SecurityUtils.currentUser());
        return accountService.accountDetail(id, orgId);
    }

    @GetMapping("/{id}/aging")
    public Map<String, Object> aging(@PathVariable Long id) {
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(id, orgId, SecurityUtils.currentUser());
        return accountService.aging(id, orgId);
    }

    /** P1 #37 -- score history for a sparkline on the account detail page. */
    @GetMapping("/{id}/score-history")
    public List<com.clearar.collections.collectionsapp.entity.AccountScore> scoreHistory(@PathVariable Long id) {
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(id, orgId, SecurityUtils.currentUser());
        return accountService.scoreHistory(id, orgId);
    }

    @GetMapping("/{id}/score-breakdown")
    public List<ScoreFactorItem> scoreBreakdown(@PathVariable Long id) {
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(id, orgId, SecurityUtils.currentUser());
        Map<String, Object> detail = accountService.accountDetail(id, orgId);
        //noinspection unchecked
        return (List<ScoreFactorItem>) detail.get("scoreBreakdown");
    }

    /** P1 #33 -- auto-generated handoff summary: last contact, PTP history, open disputes, score breakdown. */
    @GetMapping("/{id}/handoff-summary")
    public Map<String, Object> handoffSummary(@PathVariable Long id) {
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(id, orgId, SecurityUtils.currentUser());
        return accountService.handoffSummary(id, orgId);
    }

    /** P1 #31 -- suggested-action/talking-points based on aging bucket + last contact date. */
    @GetMapping("/{id}/talking-points")
    public List<String> talkingPoints(@PathVariable Long id) {
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(id, orgId, SecurityUtils.currentUser());
        return accountService.talkingPoints(id, orgId);
    }

    /** P1 #39 -- bulk actions: POST /api/accounts/bulk-reminder respects credit holds and ownership routing. */
    @PostMapping("/bulk-reminder")
    public List<Map<String, Object>> bulkReminder(@Valid @RequestBody com.clearar.collections.collectionsapp.dto.BulkAccountIdsRequest req) {
        var currentUser = SecurityUtils.currentUser();
        if ("relationship_owner".equalsIgnoreCase(currentUser.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Relationship owners cannot send direct reminders");
        }
        Long orgId = SecurityUtils.requireOrgId();
        Long userId = currentUser.getUserId();
        List<Map<String, Object>> results = new java.util.ArrayList<>();
        for (Long accountId : req.getAccountIds()) {
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("accountId", accountId);
            try {
                var account = accountService.getScopedForUser(accountId, orgId, currentUser);
                if (account.isCreditHold()) {
                    row.put("status", "skipped: account on credit hold");
                    results.add(row);
                    continue;
                }
                Map<String, Object> outreachResult = accountService.requestOutreach(accountId, orgId, userId, acc -> {
                    String bucket = accountService.worstAgingBucketForAccount(acc.getId());
                    communicationService.sendReminder(acc, bucket, userId);
                });
                row.put("status", outreachResult.get("action"));
                if (outreachResult.containsKey("routedTo")) {
                    row.put("routedTo", outreachResult.get("routedTo"));
                }
                if (outreachResult.containsKey("taskId")) {
                    row.put("taskId", outreachResult.get("taskId"));
                }
            } catch (org.springframework.web.server.ResponseStatusException e) {
                row.put("status", "skipped: " + e.getReason());
            }
            results.add(row);
        }
        return results;
    }

    /** P1 #39 -- bulk actions: POST /api/accounts/bulk-reassign loops a relationshipOwnerId update. */
    @PostMapping("/bulk-reassign")
    public List<Map<String, Object>> bulkReassign(@Valid @RequestBody com.clearar.collections.collectionsapp.dto.BulkReassignRequest req) {
        Long orgId = SecurityUtils.requireOrgId();
        SecurityUtils.requireRole("manager");
        return accountService.bulkReassign(req.getAccountIds(), req.getRelationshipOwnerId(), orgId);
    }

    /** P0.6 #20 -- direct -> send reminder now; indirect -> create a co_actor_task instead. */
    @PostMapping("/{id}/request-outreach")
    public Map<String, Object> requestOutreach(@PathVariable Long id) {
        var user = SecurityUtils.currentUser();
        if ("relationship_owner".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Relationship owners cannot request outreach");
        }
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(id, orgId, user);
        Long userId = user.getUserId();
        return accountService.requestOutreach(id, orgId, userId, account -> {
            String bucket = accountService.worstAgingBucketForAccount(account.getId());
            communicationService.sendReminder(account, bucket, userId);
        });
    }

    /** P1 #43 -- CSV import: multipart file, bulk-inserts into accounts/invoices with basic validation. */
    @PostMapping("/import")
    public Map<String, Object> importCsv(@RequestParam("file") MultipartFile file) {
        Long orgId = SecurityUtils.requireOrgId();
        SecurityUtils.requireRole("manager");
        return importService.importCsv(file, orgId);
    }

    /** P1 #45 -- write-off / credit-hold approval workflow. Manager-only, logs an audit note. */
    @PatchMapping("/{id}/credit-hold")
    public Account creditHold(@PathVariable Long id, @Valid @RequestBody CreditHoldRequest req) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        Long userId = SecurityUtils.currentUser().getUserId();
        return accountService.setCreditHold(id, orgId, req.isCreditHold(), req.getReason(), userId);
    }

    /** P1 #48 -- ownership-mode override (bulk), same loop-and-update pattern as bulk-reassign. */
    @PatchMapping("/bulk-ownership-mode")
    public List<Map<String, Object>> bulkOwnershipMode(@Valid @RequestBody BulkOwnershipModeRequest req) {
        Long orgId = SecurityUtils.requireOrgId();
        SecurityUtils.requireRole("manager");
        return accountService.bulkOwnershipMode(req.getAccountIds(), req.getOwnershipMode(), req.getRelationshipOwnerId(), orgId);
    }

    /** Manager single assignment: PATCH /api/accounts/{id}/assign-collector */
    @PatchMapping("/{id}/assign-collector")
    public Account assignCollector(@PathVariable Long id, @RequestBody com.clearar.collections.collectionsapp.dto.AccountAssignCollectorRequest req) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        Long userId = SecurityUtils.currentUser().getUserId();
        return accountService.assignCollector(id, req.getCollectorId(), orgId, userId);
    }

    /** Manager bulk assignment: POST /api/accounts/bulk-assign-collector */
    @PostMapping("/bulk-assign-collector")
    public List<Map<String, Object>> bulkAssignCollector(@Valid @RequestBody com.clearar.collections.collectionsapp.dto.BulkAssignCollectorRequest req) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        Long userId = SecurityUtils.currentUser().getUserId();
        return accountService.bulkAssignCollector(req.getAccountIds(), req.getCollectorId(), orgId, userId);
    }

    /** Manager auto-distribution: POST /api/accounts/auto-distribute */
    @PostMapping("/auto-distribute")
    public List<Map<String, Object>> autoDistribute(@Valid @RequestBody com.clearar.collections.collectionsapp.dto.AutoDistributeRequest req) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        Long userId = SecurityUtils.currentUser().getUserId();
        return accountService.autoDistribute(req.getAccountIds(), req.getCollectorIds(), req.getStrategy(), orgId, userId);
    }
}
