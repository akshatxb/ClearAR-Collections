package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * P1 #32 -- SLA-based escalation engine. checkSlaBreaches() is exposed as a manual-trigger
 * endpoint (POST /api/admin/run-escalation-check) instead of a real cron, per the build spec --
 * you want to fire this live in a demo, not wait on a timer.
 * P1 #34 -- every escalation writes an EscalationEvent, forming the history log.
 */
@Service
@RequiredArgsConstructor
public class EscalationService {

    private static final List<String> BUCKET_ORDER = List.of("0-30", "31-60", "61-90", "90+");
    private static final int COOLDOWN_HOURS = 24; // don't re-escalate the same account more than once/day

    private final EscalationRuleRepository escalationRuleRepository;
    private final EscalationEventRepository escalationEventRepository;
    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final UserRepository userRepository;
    private final AccountService accountService;
    private final NotificationService notificationService;
    private final EmailService emailService;

    /** GET-style read, seeding sensible defaults the first time (same pattern as ScoringService.defaultFactors). */
    public List<EscalationRule> getRules(Long orgId) {
        List<EscalationRule> rules = escalationRuleRepository.findByOrgIdAndActiveTrue(orgId);
        if (rules.isEmpty()) {
            rules = defaultRules(orgId);
        }
        return rules;
    }

    public List<EscalationRule> defaultRules(Long orgId) {
        List<EscalationRule> defaults = List.of(
                EscalationRule.builder().orgId(orgId).agingBucket("61-90").escalateToRole(Role.manager).active(true).build(),
                EscalationRule.builder().orgId(orgId).agingBucket("90+").escalateToRole(Role.manager).active(true).build());
        return escalationRuleRepository.saveAll(defaults);
    }

    public EscalationRule createRule(Long orgId, String agingBucket, Role escalateToRole) {
        if (agingBucket == null || !BUCKET_ORDER.contains(agingBucket)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid aging bucket. Allowed: " + BUCKET_ORDER);
        }
        if (escalateToRole == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Escalate-to role is required");
        }
        EscalationRule rule = EscalationRule.builder()
                .orgId(orgId)
                .agingBucket(agingBucket)
                .escalateToRole(escalateToRole)
                .active(true)
                .build();
        return escalationRuleRepository.save(rule);
    }

    public EscalationRule updateRule(Long orgId, Long ruleId, String agingBucket, Role escalateToRole, Boolean active) {
        EscalationRule rule = escalationRuleRepository.findById(ruleId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Escalation rule not found"));
        if (!orgId.equals(rule.getOrgId())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "Escalation rule does not belong to this organization");
        }
        if (agingBucket != null) {
            if (!BUCKET_ORDER.contains(agingBucket)) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid aging bucket. Allowed: " + BUCKET_ORDER);
            }
            rule.setAgingBucket(agingBucket);
        }
        if (escalateToRole != null) {
            rule.setEscalateToRole(escalateToRole);
        }
        if (active != null) {
            rule.setActive(active);
        }
        return escalationRuleRepository.save(rule);
    }

    public void deleteRule(Long orgId, Long ruleId) {
        EscalationRule rule = escalationRuleRepository.findById(ruleId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Escalation rule not found"));
        if (!orgId.equals(rule.getOrgId())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "Escalation rule does not belong to this organization");
        }
        escalationRuleRepository.delete(rule);
    }

    /**
     * Walk every account in the org; for each active rule, escalate any account whose worst
     * aging bucket has reached (or passed) the rule's threshold, unless it was already escalated
     * within the cooldown window. Returns the events created by this run.
     */
    public List<EscalationEvent> checkSlaBreaches(Long orgId) {
        List<EscalationRule> rules = getRules(orgId);
        if (rules.isEmpty()) return List.of();

        List<EscalationEvent> created = new ArrayList<>();
        Map<Role, List<User>> targetsByRole = new HashMap<>();
        Instant cooldownStart = Instant.now().minus(COOLDOWN_HOURS, ChronoUnit.HOURS);

        List<EscalationRule> sortedRules = rules.stream()
                .sorted(Comparator.comparingInt((EscalationRule r) -> BUCKET_ORDER.indexOf(r.getAgingBucket())).reversed())
                .toList();

        for (Account account : accountRepository.findByOrgId(orgId)) {
            List<Invoice> invoices = invoiceRepository.findByAccountId(account.getId());
            String worstBucket = accountService.worstAgingBucket(invoices);
            int worstIdx = BUCKET_ORDER.indexOf(worstBucket);
            if (worstIdx < 0) continue; // "current" -- nothing overdue, nothing to escalate

            for (EscalationRule rule : sortedRules) {
                int ruleIdx = BUCKET_ORDER.indexOf(rule.getAgingBucket());
                if (ruleIdx < 0 || worstIdx < ruleIdx) continue;

                boolean alreadyEscalatedRecently = !escalationEventRepository
                        .findByAccountIdAndCreatedAtAfter(account.getId(), cooldownStart).isEmpty();
                if (alreadyEscalatedRecently) continue;

                User targetUser = null;
                if (rule.getEscalateToRole() == Role.relationship_owner && account.getRelationshipOwnerId() != null) {
                    targetUser = userRepository.findById(account.getRelationshipOwnerId())
                            .filter(u -> u.isActive() && orgId.equals(u.getOrgId()))
                            .orElse(null);
                }

                if (targetUser == null) {
                    List<User> targets = targetsByRole.computeIfAbsent(rule.getEscalateToRole(),
                            role -> userRepository.findByOrgIdAndRoleAndActiveTrue(orgId, role));
                    if (targets.isEmpty()) continue; // no one to escalate to -- skip rather than fail the whole run
                    targetUser = targets.get(0);
                }

                EscalationEvent event = EscalationEvent.builder()
                        .accountId(account.getId())
                        .fromUser(account.getRelationshipOwnerId())
                        .toUser(targetUser.getId())
                        .reason("Aging bucket " + worstBucket + " breached SLA rule (threshold " + rule.getAgingBucket() + ")")
                        .build();
                created.add(escalationEventRepository.save(event));
                notificationService.notify(event.getToUser(), "escalation",
                        Map.of("accountId", account.getId(), "reason", event.getReason()));

                // Send email notification to escalation target
                if (targetUser.getEmail() != null) {
                    emailService.sendEscalationAlert(orgId, targetUser.getEmail(), targetUser.getName(),
                            account.getName(), event.getReason());
                }

                break; // one escalation per account per run is enough, even if multiple rules matched
            }
        }
        return created;
    }

    /** P1 #34 -- history log for the manager screen. */
    public List<EscalationEvent> history(Long orgId) {
        List<Long> accountIds = accountRepository.findByOrgId(orgId).stream()
                .map(Account::getId).collect(Collectors.toList());
        if (accountIds.isEmpty()) {
            return List.of();
        }
        return escalationEventRepository.findByAccountIdIn(accountIds);
    }
}
