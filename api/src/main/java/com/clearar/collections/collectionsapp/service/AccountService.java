package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.*;
import com.clearar.collections.collectionsapp.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final AccountScoreRepository accountScoreRepository;
    private final CommunicationRepository communicationRepository;
    private final ScoringService scoringService;
    private final CoActorTaskRepository coActorTaskRepository;
    private final PtpRepository ptpRepository;
    private final DisputeRepository disputeRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final InvoiceService invoiceService;
    private final EmailService emailService;

    public Account getScoped(Long accountId, Long orgId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        if (!account.getOrgId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account not in your organization");
        }
        return account;
    }

    public Account getScopedForUser(Long accountId, Long orgId, AuthenticatedUser user) {
        Account account = getScoped(accountId, orgId);
        if (user != null && "collector".equalsIgnoreCase(user.getRole())) {
            if (account.getAssignedCollectorId() == null || !account.getAssignedCollectorId().equals(user.getUserId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: collectors can only access accounts assigned to their portfolio.");
            }
        }
        return account;
    }

    /**
     * Account ids a user may see in org-wide lists. Returns null (= unrestricted) for non-collectors;
     * for collectors, only the ids of accounts assigned to them.
     */
    public java.util.Set<Long> visibleAccountIds(Long orgId, AuthenticatedUser user) {
        if (user == null || !"collector".equalsIgnoreCase(user.getRole())) {
            return null;
        }
        return accountRepository.findByOrgId(orgId).stream()
                .filter(a -> user.getUserId().equals(a.getAssignedCollectorId()))
                .map(Account::getId)
                .collect(java.util.stream.Collectors.toSet());
    }

    /** P0.2 #4 -- customer/account master record creation. */
    public Account create(Long orgId, String name, String contactEmail, String contactPhone,
                           String creditTerms, String ownershipMode, Long relationshipOwnerId) {
        return create(orgId, name, contactEmail, contactPhone, creditTerms, ownershipMode, relationshipOwnerId, null);
    }

    public Account create(Long orgId, String name, String contactEmail, String contactPhone,
                           String creditTerms, String ownershipMode, Long relationshipOwnerId, Long assignedCollectorId) {
        String effectiveOwnershipMode = ownershipMode != null ? ownershipMode.toLowerCase() : "direct";
        if (relationshipOwnerId != null) {
            validateRelationshipOwner(relationshipOwnerId, orgId);
            effectiveOwnershipMode = "indirect";
        } else if ("indirect".equalsIgnoreCase(effectiveOwnershipMode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "relationshipOwnerId required for indirect accounts");
        } else if (!"direct".equalsIgnoreCase(effectiveOwnershipMode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ownershipMode must be 'direct' or 'indirect'");
        }
        if (assignedCollectorId != null) {
            validateCollector(assignedCollectorId, orgId);
        }
        Account account = Account.builder()
                .orgId(orgId)
                .name(name)
                .contactEmail(contactEmail)
                .contactPhone(contactPhone)
                .creditTerms(creditTerms)
                .ownershipMode(effectiveOwnershipMode)
                .relationshipOwnerId(relationshipOwnerId)
                .assignedCollectorId(assignedCollectorId)
                .creditHold(false)
                .build();
        account = accountRepository.save(account);

        // Send Welcome & Onboarding Email
        try {
            emailService.sendAccountWelcome(account);
        } catch (Exception e) {
            // Non-blocking for account creation transaction
        }

        return account;
    }

    /** P0.3 #11 -- GET /api/accounts?sort=priority_score DESC. Worklist = collector landing page. */
    public List<Map<String, Object>> worklist(Long orgId, String agingBucket, String ownershipMode, Long assignedTo) {
        return worklist(orgId, agingBucket, ownershipMode, assignedTo, null, null);
    }

    public List<Map<String, Object>> worklist(Long orgId, String agingBucket, String ownershipMode,
                                              Long assignedTo, Long collectorId, Boolean unassignedOnly) {
        List<Account> accounts = accountRepository.findByOrgId(orgId);
        Map<Long, String> staffNames = userRepository.findByOrgId(orgId).stream()
                .collect(Collectors.toMap(User::getId, u -> u.getName() != null ? u.getName() : u.getEmail(), (a, b) -> a));

        List<Map<String, Object>> results = new ArrayList<>();
        for (Account acc : accounts) {
            if (ownershipMode != null && !ownershipMode.equalsIgnoreCase(acc.getOwnershipMode())) continue;
            if (assignedTo != null && !assignedTo.equals(acc.getRelationshipOwnerId()) && !assignedTo.equals(acc.getAssignedCollectorId())) continue;
            if (collectorId != null && !collectorId.equals(acc.getAssignedCollectorId())) continue;
            if (Boolean.TRUE.equals(unassignedOnly) && acc.getAssignedCollectorId() != null) continue;

            List<Invoice> invoices = invoiceRepository.findByAccountId(acc.getId());
            String bucket = worstAgingBucket(invoices);
            if (agingBucket != null && !agingBucket.equalsIgnoreCase(bucket)) continue;

            double score = accountScoreRepository.findTopByAccountIdOrderByComputedAtDesc(acc.getId())
                    .map(AccountScore::getTotalScore).orElse(0.0);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", acc.getId());
            row.put("name", acc.getName());
            row.put("contactEmail", acc.getContactEmail());
            row.put("contactPhone", acc.getContactPhone());
            row.put("creditTerms", acc.getCreditTerms());
            row.put("ownershipMode", acc.getOwnershipMode());
            row.put("relationshipOwnerId", acc.getRelationshipOwnerId());
            row.put("relationshipOwnerName", acc.getRelationshipOwnerId() != null ? staffNames.get(acc.getRelationshipOwnerId()) : null);
            row.put("assignedCollectorId", acc.getAssignedCollectorId());
            row.put("assignedCollectorName", acc.getAssignedCollectorId() != null ? staffNames.get(acc.getAssignedCollectorId()) : null);
            row.put("creditHold", acc.isCreditHold());
            row.put("agingBucket", bucket);
            row.put("openBalance", openBalance(invoices));
            row.put("priorityScore", score);

            List<Ptp> ptps = ptpRepository.findByAccountId(acc.getId());
            long brokenPtpCount = ptps.stream().filter(p -> p.getStatus() == PtpStatus.broken).count();
            LocalDate today = LocalDate.now();
            long activePtpCount = ptps.stream()
                    .filter(p -> p.getStatus() == PtpStatus.pending
                            && (p.getPromisedDate() == null || !p.getPromisedDate().isBefore(today)))
                    .count();
            long keptPtpCount = ptps.stream().filter(p -> p.getStatus() == PtpStatus.kept).count();
            long resolvedPtps = keptPtpCount + brokenPtpCount;
            double ptpKeptRatio = resolvedPtps > 0 ? (double) keptPtpCount / resolvedPtps : 0.0;

            List<Dispute> disputes = disputeRepository.findByAccountId(acc.getId());
            long openDisputeCount = disputes.stream()
                    .filter(d -> d.getStatus() != DisputeStatus.resolved)
                    .count();

            double weightedDpd = scoringService.computeWeightedDpd(invoices);
            double recentPaymentsK = scoringService.computeRecentPaymentsK(invoices);

            boolean hasBrokenPtp = brokenPtpCount > 0;
            boolean hasPendingPtp = ptps.stream().anyMatch(p -> p.getStatus() == PtpStatus.pending);
            boolean hasDispute = openDisputeCount > 0;

            row.put("hasBrokenPtp", hasBrokenPtp);
            row.put("hasPendingPtp", hasPendingPtp);
            row.put("hasDispute", hasDispute);
            row.put("brokenPtpCount", brokenPtpCount);
            row.put("activePtpCount", activePtpCount);
            row.put("ptpKeptRatio", Math.round(ptpKeptRatio * 100.0) / 100.0);
            row.put("openDisputeCount", openDisputeCount);
            row.put("disputeCount", openDisputeCount);
            row.put("weightedDpd", Math.round(weightedDpd * 10.0) / 10.0);
            row.put("recentPaymentsK", Math.round(recentPaymentsK * 100.0) / 100.0);

            results.add(row);
        }

        results.sort((a, b) -> Double.compare((double) b.get("priorityScore"), (double) a.get("priorityScore")));
        return results;
    }

    /** P0.4 #12 -- single joined response: account + invoices + payments + score breakdown + comms. */
    public Map<String, Object> accountDetail(Long accountId, Long orgId) {
        Account account = getScoped(accountId, orgId);
        List<Invoice> invoices = invoiceRepository.findByAccountId(accountId);
        Map<Long, BigDecimal> remainingMap = invoiceService.getRemainingBalances(invoices);

        List<Map<String, Object>> invoicesWithPayments = invoices.stream().map(inv -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", inv.getId());
            m.put("amount", inv.getAmount());
            m.put("remainingBalance", remainingMap.getOrDefault(inv.getId(), inv.getAmount()));
            m.put("dueDate", inv.getDueDate());
            m.put("status", inv.getStatus());
            m.put("agingBucket", ScoringService.agingBucket(inv.getDueDate()));
            m.put("payments", paymentRepository.findByInvoiceId(inv.getId()));
            return m;
        }).collect(Collectors.toList());

        Optional<AccountScore> latestScore = accountScoreRepository.findTopByAccountIdOrderByComputedAtDesc(accountId);

        List<Communication> recentComms = communicationRepository.findByAccountIdOrderByCreatedAtDesc(accountId)
                .stream().limit(5).toList();
        for (Communication c : recentComms) {
            if (c.getCreatedBy() != null) {
                userRepository.findById(c.getCreatedBy()).ifPresent(u -> c.setCreatedByName(u.getName()));
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("account", account);
        if (account.getAssignedCollectorId() != null) {
            userRepository.findById(account.getAssignedCollectorId()).ifPresent(u -> {
                result.put("assignedCollectorName", u.getName() != null ? u.getName() : u.getEmail());
            });
        }
        if (account.getRelationshipOwnerId() != null) {
            userRepository.findById(account.getRelationshipOwnerId()).ifPresent(u -> {
                result.put("relationshipOwnerName", u.getName() != null ? u.getName() : u.getEmail());
            });
        }
        result.put("invoices", invoicesWithPayments);
        result.put("openBalance", openBalance(invoices));
        result.put("agingBucket", worstAgingBucket(invoices));
        result.put("scoreBreakdown", latestScore.map(s -> scoringService.parseBreakdown(s.getBreakdownJson())).orElse(List.of()));
        result.put("priorityScore", latestScore.map(AccountScore::getTotalScore).orElse(0.0));
        result.put("recentCommunications", recentComms);
        return result;
    }

    /** P1 #37 -- score history for a sparkline (account_scores is insert-not-overwrite, ordered ASC by computedAt). */
    public List<AccountScore> scoreHistory(Long accountId, Long orgId) {
        getScoped(accountId, orgId);
        return accountScoreRepository.findByAccountIdOrderByComputedAtAsc(accountId);
    }

    /** P0.2 #7 -- GET /api/accounts/:id/aging. */
    public Map<String, Object> aging(Long accountId, Long orgId) {
        getScoped(accountId, orgId);
        List<Invoice> invoices = invoiceRepository.findByAccountId(accountId);
        Map<Long, BigDecimal> remainingMap = invoiceService.getRemainingBalances(invoices);

        Map<String, BigDecimal> byBucket = new LinkedHashMap<>();
        for (String b : List.of("current", "0-30", "31-60", "61-90", "90+")) byBucket.put(b, BigDecimal.ZERO);

        for (Invoice inv : invoices) {
            if (inv.getStatus() == InvoiceStatus.paid || inv.getStatus() == InvoiceStatus.written_off) continue;
            BigDecimal rem = remainingMap.getOrDefault(inv.getId(), inv.getAmount());
            if (rem.signum() <= 0) continue;
            String bucket = ScoringService.agingBucket(inv.getDueDate());
            byBucket.merge(bucket, rem, BigDecimal::add);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("accountId", accountId);
        result.put("byBucket", byBucket);
        result.put("worstBucket", worstAgingBucket(invoices));
        return result;
    }

    /**
     * P1 #33 -- auto-generated handoff summary: last contact, PTP history, open disputes,
     * score breakdown, all pulled into one object (e.g. for an escalation or reassignment).
     */
    public Map<String, Object> handoffSummary(Long accountId, Long orgId) {
        Account account = getScoped(accountId, orgId);
        List<Invoice> invoices = invoiceRepository.findByAccountId(accountId);
        List<Communication> comms = communicationRepository.findByAccountIdOrderByCreatedAtDesc(accountId);
        List<Ptp> ptps = ptpRepository.findByAccountId(accountId);
        List<Dispute> disputes = disputeRepository.findByAccountId(accountId);
        Optional<AccountScore> latestScore = accountScoreRepository.findTopByAccountIdOrderByComputedAtDesc(accountId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("account", account);
        result.put("openBalance", openBalance(invoices));
        result.put("agingBucket", worstAgingBucket(invoices));
        result.put("lastContact", comms.isEmpty() ? null : comms.get(0));
        result.put("ptpHistory", ptps);
        result.put("openDisputes", disputes.stream().filter(d -> d.getStatus() != DisputeStatus.resolved).toList());
        result.put("scoreBreakdown", latestScore.map(s -> scoringService.parseBreakdown(s.getBreakdownJson())).orElse(List.of()));
        result.put("priorityScore", latestScore.map(AccountScore::getTotalScore).orElse(0.0));
        return result;
    }

    /**
     * P1 #31 -- suggested-action/talking-points generation: simple templated strings based on
     * aging bucket, days since last contact, open balance, broken PTPs, and open disputes.
     * No LLM call needed at this scale -- straightforward string templates.
     */
    public List<String> talkingPoints(Long accountId, Long orgId) {
        Account account = getScoped(accountId, orgId);
        List<Invoice> invoices = invoiceRepository.findByAccountId(accountId);
        List<Communication> comms = communicationRepository.findByAccountIdOrderByCreatedAtDesc(accountId);
        List<Ptp> ptps = ptpRepository.findByAccountId(accountId);
        List<Dispute> disputes = disputeRepository.findByAccountId(accountId);

        List<String> points = new ArrayList<>();
        String bucket = worstAgingBucket(invoices);
        BigDecimal balance = openBalance(invoices);

        if (!comms.isEmpty()) {
            long daysSinceContact = java.time.temporal.ChronoUnit.DAYS.between(
                    comms.get(0).getCreatedAt(), java.time.Instant.now());
            points.add("It's been " + daysSinceContact + " day(s) since last contact ("
                    + comms.get(0).getType() + ") -- $" + balance + " outstanding across the "
                    + bucket + " bucket.");
        } else {
            points.add("No prior contact logged for " + account.getName() + " -- $" + balance
                    + " outstanding across the " + bucket + " bucket. Good candidate for a first outreach.");
        }

        long brokenPtps = ptps.stream().filter(p -> p.getStatus() == PtpStatus.broken).count();
        if (brokenPtps > 0) {
            points.add("Customer has broken " + brokenPtps + " promise-to-pay commitment(s) previously -- "
                    + "consider asking for a firmer payment method or shorter promise window.");
        }

        long openDisputes = disputes.stream().filter(d -> d.getStatus() != DisputeStatus.resolved).count();
        if (openDisputes > 0) {
            points.add(openDisputes + " open dispute(s) on this account -- confirm whether payment is "
                    + "being withheld pending resolution before pushing for a promise-to-pay.");
        }

        if ("90+".equals(bucket) || "61-90".equals(bucket)) {
            points.add("Account is significantly overdue (" + bucket + ") -- this is a strong candidate "
                    + "for escalation if a firm commitment isn't reached on this contact.");
        }

        return points;
    }

    /**
     * P1 #39 -- bulk-reassign: loops a plain relationshipOwnerId update across the given
     * accounts (same pattern as bulk-reminder looping #15). Skips accounts not found or not
     * in the caller's org instead of failing the whole batch.
     */
    public List<Map<String, Object>> bulkReassign(List<Long> accountIds, Long relationshipOwnerId, Long orgId) {
        validateRelationshipOwner(relationshipOwnerId, orgId);
        List<Map<String, Object>> results = new ArrayList<>();
        for (Long accountId : accountIds) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("accountId", accountId);
            try {
                Account account = getScoped(accountId, orgId);
                account.setRelationshipOwnerId(relationshipOwnerId);
                if (!"indirect".equalsIgnoreCase(account.getOwnershipMode())) {
                    account.setOwnershipMode("indirect"); // reassigning a relationship owner implies indirect ownership
                }
                accountRepository.save(account);
                row.put("status", "reassigned");
            } catch (ResponseStatusException e) {
                row.put("status", "skipped: " + e.getReason());
            }
            results.add(row);
        }
        return results;
    }

    /**
     * P1 #45 -- write-off / credit-hold approval workflow. Manager-only (enforced at the
     * controller), simple boolean toggle with an audit-log entry -- logged as a 'note'
     * communication since there's no dedicated audit_log table at this scale.
     */
    public Account setCreditHold(Long accountId, Long orgId, boolean creditHold, String reason, Long userId) {
        Account account = getScoped(accountId, orgId);
        account.setCreditHold(creditHold);
        account = accountRepository.save(account);

        String note = (creditHold ? "Credit hold placed" : "Credit hold released")
                + (reason != null && !reason.isBlank() ? " -- reason: " + reason : "");
        communicationRepository.save(Communication.builder()
                .accountId(accountId)
                .type("note")
                .content(note)
                .createdBy(userId)
                .build());
        return account;
    }

    /**
     * P1 #48 -- ownership-mode override (bulk). Same loop-and-update pattern as bulkReassign;
     * skips accounts not found or not in the caller's org instead of failing the whole batch.
     */
    public List<Map<String, Object>> bulkOwnershipMode(List<Long> accountIds, String ownershipMode, Long relationshipOwnerId, Long orgId) {
        if (!"direct".equalsIgnoreCase(ownershipMode) && !"indirect".equalsIgnoreCase(ownershipMode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ownershipMode must be 'direct' or 'indirect'");
        }
        if ("indirect".equalsIgnoreCase(ownershipMode)) {
            if (relationshipOwnerId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "relationshipOwnerId required for indirect accounts");
            }
            validateRelationshipOwner(relationshipOwnerId, orgId);
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (Long accountId : accountIds) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("accountId", accountId);
            try {
                Account account = getScoped(accountId, orgId);
                account.setOwnershipMode(ownershipMode.toLowerCase());
                account.setRelationshipOwnerId("indirect".equalsIgnoreCase(ownershipMode) ? relationshipOwnerId : null);
                accountRepository.save(account);
                row.put("status", "updated");
            } catch (ResponseStatusException e) {
                row.put("status", "skipped: " + e.getReason());
            }
            results.add(row);
        }
        return results;
    }

    public void validateRelationshipOwner(Long relationshipOwnerId, Long orgId) {
        if (relationshipOwnerId == null) return;
        User user = userRepository.findById(relationshipOwnerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Relationship owner user not found"));
        if (!orgId.equals(user.getOrgId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Relationship owner must belong to your organization");
        }
        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Relationship owner account is deactivated");
        }
        if (user.getRole() != Role.relationship_owner) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned user must have relationship_owner role");
        }
    }

    public User validateCollector(Long collectorId, Long orgId) {
        if (collectorId == null) return null;
        User user = userRepository.findById(collectorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Collector user not found"));
        if (!orgId.equals(user.getOrgId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Collector must belong to your organization");
        }
        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Collector user is deactivated");
        }
        if (user.getRole() != Role.collector) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned user must have collector role. Managers cannot be assigned to direct accounts.");
        }
        return user;
    }

    public Account assignCollector(Long accountId, Long collectorId, Long orgId, Long managerUserId) {
        Account account = getScoped(accountId, orgId);
        String collectorName = "Unassigned";
        if (collectorId != null) {
            User c = validateCollector(collectorId, orgId);
            collectorName = c.getName() != null ? c.getName() : c.getEmail();
        }
        account.setAssignedCollectorId(collectorId);
        account = accountRepository.save(account);

        String note = collectorId != null
                ? "Account assigned to collector: " + collectorName
                : "Account collector assignment removed (Unassigned)";
        communicationRepository.save(Communication.builder()
                .accountId(accountId)
                .type("note")
                .content(note)
                .createdBy(managerUserId)
                .build());
        return account;
    }

    public List<Map<String, Object>> bulkAssignCollector(List<Long> accountIds, Long collectorId, Long orgId, Long managerUserId) {
        User collector = null;
        if (collectorId != null) {
            collector = validateCollector(collectorId, orgId);
        }
        String collectorName = collector != null
                ? (collector.getName() != null ? collector.getName() : collector.getEmail())
                : "Unassigned";

        List<Map<String, Object>> results = new ArrayList<>();
        for (Long accountId : accountIds) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("accountId", accountId);
            try {
                Account account = getScoped(accountId, orgId);
                account.setAssignedCollectorId(collectorId);
                accountRepository.save(account);

                String note = collectorId != null
                        ? "Account bulk-assigned to collector: " + collectorName
                        : "Account collector assignment removed (Unassigned)";
                communicationRepository.save(Communication.builder()
                        .accountId(accountId)
                        .type("note")
                        .content(note)
                        .createdBy(managerUserId)
                        .build());
                row.put("status", "assigned");
                row.put("assignedCollectorId", collectorId);
                row.put("assignedCollectorName", collectorName);
            } catch (ResponseStatusException e) {
                row.put("status", "skipped: " + e.getReason());
            }
            results.add(row);
        }
        return results;
    }

    public List<Map<String, Object>> autoDistribute(List<Long> accountIds, List<Long> collectorIds, String strategy, Long orgId, Long managerUserId) {
        if (collectorIds == null || collectorIds.isEmpty()) {
            collectorIds = userRepository.findByOrgIdAndRoleAndActiveTrue(orgId, Role.collector).stream()
                    .map(User::getId)
                    .collect(Collectors.toList());
        }
        if (collectorIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No active collectors found in the organization for auto-distribution");
        }
        for (Long cid : collectorIds) {
            validateCollector(cid, orgId);
        }

        List<Account> targetAccounts = new ArrayList<>();
        if (accountIds != null && !accountIds.isEmpty()) {
            for (Long aid : accountIds) {
                try {
                    targetAccounts.add(getScoped(aid, orgId));
                } catch (Exception ignored) {}
            }
        } else {
            targetAccounts = accountRepository.findByOrgId(orgId).stream()
                    .filter(a -> a.getAssignedCollectorId() == null)
                    .collect(Collectors.toList());
        }

        if (targetAccounts.isEmpty()) {
            return List.of();
        }

        if ("balanced_balance".equalsIgnoreCase(strategy)) {
            Map<Long, BigDecimal> collectorLoad = new HashMap<>();
            for (Long cid : collectorIds) collectorLoad.put(cid, BigDecimal.ZERO);

            for (Account a : accountRepository.findByOrgId(orgId)) {
                if (a.getAssignedCollectorId() != null && collectorLoad.containsKey(a.getAssignedCollectorId())) {
                    BigDecimal bal = openBalance(invoiceRepository.findByAccountId(a.getId()));
                    collectorLoad.merge(a.getAssignedCollectorId(), bal, BigDecimal::add);
                }
            }

            targetAccounts.sort((a, b) -> {
                BigDecimal balA = openBalance(invoiceRepository.findByAccountId(a.getId()));
                BigDecimal balB = openBalance(invoiceRepository.findByAccountId(b.getId()));
                return balB.compareTo(balA);
            });

            List<Map<String, Object>> results = new ArrayList<>();
            for (Account a : targetAccounts) {
                Long chosen = collectorIds.stream()
                        .min(Comparator.comparing(collectorLoad::get))
                        .orElse(collectorIds.get(0));

                a.setAssignedCollectorId(chosen);
                accountRepository.save(a);
                BigDecimal bal = openBalance(invoiceRepository.findByAccountId(a.getId()));
                collectorLoad.merge(chosen, bal, BigDecimal::add);

                User u = userRepository.findById(chosen).orElse(null);
                String cName = u != null ? (u.getName() != null ? u.getName() : u.getEmail()) : "Collector #" + chosen;

                communicationRepository.save(Communication.builder()
                        .accountId(a.getId())
                        .type("note")
                        .content("Auto-distributed to collector: " + cName)
                        .createdBy(managerUserId)
                        .build());

                Map<String, Object> r = new LinkedHashMap<>();
                r.put("accountId", a.getId());
                r.put("assignedCollectorId", chosen);
                r.put("assignedCollectorName", cName);
                r.put("status", "distributed");
                results.add(r);
            }
            return results;
        } else {
            List<Map<String, Object>> results = new ArrayList<>();
            int idx = 0;
            for (Account a : targetAccounts) {
                Long chosen = collectorIds.get(idx % collectorIds.size());
                idx++;
                a.setAssignedCollectorId(chosen);
                accountRepository.save(a);

                User u = userRepository.findById(chosen).orElse(null);
                String cName = u != null ? (u.getName() != null ? u.getName() : u.getEmail()) : "Collector #" + chosen;

                communicationRepository.save(Communication.builder()
                        .accountId(a.getId())
                        .type("note")
                        .content("Auto-distributed to collector: " + cName)
                        .createdBy(managerUserId)
                        .build());

                Map<String, Object> r = new LinkedHashMap<>();
                r.put("accountId", a.getId());
                r.put("assignedCollectorId", chosen);
                r.put("assignedCollectorName", cName);
                r.put("status", "distributed");
                results.add(r);
            }
            return results;
        }
    }

    /** P0.6 #20 -- dual-mode ownership routing. direct -> email send; indirect -> co_actor_tasks row. */
    public Map<String, Object> requestOutreach(Long accountId, Long orgId, Long requestedBy, ReminderSender reminderSender) {
        Account account = getScoped(accountId, orgId);

        if ("direct".equalsIgnoreCase(account.getOwnershipMode())) {
            reminderSender.send(account);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("routedTo", "direct");
            result.put("action", "reminder_sent");
            return result;
        } else {
            if (account.getRelationshipOwnerId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot request outreach: No relationship owner is assigned to this indirect account. Please assign a relationship owner first.");
            }
            String collectorName = userRepository.findById(requestedBy)
                    .map(User::getName)
                    .orElse("user #" + requestedBy);
            CoActorTask task = CoActorTask.builder()
                    .accountId(accountId)
                    .assignedTo(account.getRelationshipOwnerId())
                    .requestedBy(requestedBy)
                    .requestType("outreach")
                    .notes("Outreach requested by " + collectorName)
                    .status("pending")
                    .build();
            task = coActorTaskRepository.save(task);
            notificationService.notify(account.getRelationshipOwnerId(), "co_actor_task",
                    Map.of("accountId", accountId, "taskId", task.getId(), "accountName", account.getName(), "requestedBy", collectorName));
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("routedTo", "indirect");
            result.put("action", "co_actor_task_created");
            result.put("taskId", task.getId());
            return result;
        }
    }

    public interface ReminderSender {
        void send(Account account);
    }

    /** Convenience for callers (e.g. outreach routing) that only have an accountId on hand. */
    public String worstAgingBucketForAccount(Long accountId) {
        return worstAgingBucket(invoiceRepository.findByAccountId(accountId));
    }

    public BigDecimal openBalance(List<Invoice> invoices) {
        return invoiceService.calculateOpenBalance(invoices);
    }

    public String worstAgingBucket(List<Invoice> invoices) {
        List<String> order = List.of("0-30", "31-60", "61-90", "90+");
        int worstIdx = -1;
        for (Invoice inv : invoices) {
            if (inv.getStatus() == InvoiceStatus.paid || inv.getStatus() == InvoiceStatus.written_off) continue;
            int idx = order.indexOf(ScoringService.agingBucket(inv.getDueDate()));
            worstIdx = Math.max(worstIdx, idx);
        }
        return worstIdx == -1 ? "current" : order.get(worstIdx);
    }
}
