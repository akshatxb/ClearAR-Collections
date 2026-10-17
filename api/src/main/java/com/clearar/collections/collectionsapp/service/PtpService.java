package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.Ptp;
import com.clearar.collections.collectionsapp.entity.PtpStatus;
import com.clearar.collections.collectionsapp.entity.User;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.PtpRepository;
import com.clearar.collections.collectionsapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/** P0.4 #16 -- Promise-to-Pay creation & tracking; flips to broken/kept. */
@Service
@RequiredArgsConstructor
@Slf4j
public class PtpService {

    private final PtpRepository ptpRepository;
    private final OutcomeEventService outcomeEventService;
    private final AccountRepository accountRepository;
    private final ScoringService scoringService;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final InvoiceRepository invoiceRepository;

    public Ptp create(Long accountId, BigDecimal amount, LocalDate promisedDate, Long createdBy) {
        return create(accountId, amount, promisedDate, createdBy, null);
    }

    public Ptp create(Long accountId, BigDecimal amount, LocalDate promisedDate, Long createdBy, Long invoiceId) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Promised amount must be greater than zero");
        }
        if (promisedDate == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Promised date is required");
        }
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));

        if (invoiceId != null) {
            Invoice invoice = invoiceRepository.findById(invoiceId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice not found"));
            if (!accountId.equals(invoice.getAccountId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice does not belong to this account");
            }
        }

        Ptp ptp = Ptp.builder()
                .accountId(accountId)
                .invoiceId(invoiceId)
                .promisedAmount(amount)
                .promisedDate(promisedDate)
                .status(PtpStatus.pending)
                .createdBy(createdBy)
                .createdAt(java.time.Instant.now())
                .build();
        Ptp savedPtp = ptpRepository.save(ptp);
        recompute(accountId);

        // Send PTP Confirmation Email
        try {
            emailService.sendPtpConfirmation(account, savedPtp);
        } catch (Exception e) {
            // Non-blocking for PTP creation transaction
        }

        return savedPtp;
    }

    public List<Ptp> forAccount(Long accountId) {
        return ptpRepository.findByAccountId(accountId);
    }

    /**
     * On-page-load / on-demand check (no real cron at hackathon scale): flips status to broken
     * if promisedDate has passed with no matching payment recorded, else kept if paid.
     * A simplification: "paid" is inferred by caller passing whether payment coverage exists.
     */
    public Ptp markResult(Long ptpId, boolean paid) {
        Ptp ptp = ptpRepository.findById(ptpId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Promise to pay not found"));
        if (ptp.getStatus() != PtpStatus.pending) return ptp;

        if (paid) {
            ptp.setStatus(PtpStatus.kept);
        } else if (ptp.getPromisedDate() != null && LocalDate.now().isAfter(ptp.getPromisedDate())) {
            ptp.setStatus(PtpStatus.broken);
        } else {
            return ptp; // not yet due, still pending
        }
        ptp = ptpRepository.save(ptp);
        outcomeEventService.recordEvent(ptp.getAccountId(),
                ptp.getStatus() == PtpStatus.kept ? "ptp_kept" : "ptp_broken", null, ptp.getId());
        recompute(ptp.getAccountId());
        return ptp;
    }

    /** Sweep used by a manual-trigger endpoint or on-load check across all pending PTPs for an org. */
    public List<Ptp> sweepOverdue(Long orgId) {
        List<Account> accounts = accountRepository.findByOrgId(orgId);
        List<Long> accountIds = accounts.stream().map(Account::getId).toList();
        if (accountIds.isEmpty()) {
            return List.of();
        }
        List<Ptp> overdue = ptpRepository.findByAccountIdInAndStatusAndPromisedDateLessThanEqual(
                accountIds, PtpStatus.pending, LocalDate.now().minusDays(1));
        overdue.forEach(p -> markResult(p.getId(), false));
        return overdue;
    }

    public List<Ptp> sweepOverdue() {
        List<Ptp> overdue = ptpRepository.findByStatusAndPromisedDateLessThanEqual(PtpStatus.pending, LocalDate.now().minusDays(1));
        overdue.forEach(p -> markResult(p.getId(), false));
        return overdue;
    }

    /**
     * P1 #35 -- PTP due-date reminders. On-dashboard-load check (no real cron): pending PTPs
     * across the org due within the next 24h, for a banner/notification.
     */
    public List<Ptp> dueSoon(List<Long> orgAccountIds) {
        if (orgAccountIds == null || orgAccountIds.isEmpty()) {
            return List.of();
        }
        LocalDate today = LocalDate.now();
        return ptpRepository.findByAccountIdInAndStatusAndPromisedDateBetween(
                orgAccountIds, PtpStatus.pending, today, today.plusDays(1));
    }

    public List<Map<String, Object>> forOrg(Long orgId) {
        List<Account> accounts = accountRepository.findByOrgId(orgId);
        if (accounts.isEmpty()) {
            return List.of();
        }
        Map<Long, Account> accountsById = accounts.stream().collect(Collectors.toMap(Account::getId, a -> a));
        List<Long> accountIds = accounts.stream().map(Account::getId).toList();

        Map<Long, String> userNames = userRepository.findByOrgId(orgId).stream()
                .collect(Collectors.toMap(u -> u.getId(), u -> u.getName() != null ? u.getName() : u.getEmail()));

        List<Ptp> ptps = ptpRepository.findByAccountIdIn(accountIds);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Ptp p : ptps) {
            Account acc = accountsById.get(p.getAccountId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("accountId", p.getAccountId());
            m.put("accountName", acc != null ? acc.getName() : "Account #" + p.getAccountId());
            m.put("contactEmail", acc != null ? acc.getContactEmail() : null);
            m.put("contactPhone", acc != null ? acc.getContactPhone() : null);
            m.put("ownershipMode", acc != null ? acc.getOwnershipMode() : "direct");
            m.put("relationshipOwnerId", acc != null ? acc.getRelationshipOwnerId() : null);
            m.put("relationshipOwnerName", acc != null && acc.getRelationshipOwnerId() != null ? userNames.get(acc.getRelationshipOwnerId()) : null);
            m.put("promisedAmount", p.getPromisedAmount());
            m.put("promisedDate", p.getPromisedDate());
            m.put("status", p.getStatus() != null ? p.getStatus().name() : null);
            m.put("createdBy", p.getCreatedBy());
            m.put("createdByName", p.getCreatedBy() != null ? userNames.get(p.getCreatedBy()) : null);
            m.put("createdAt", p.getCreatedAt());
            result.add(m);
        }
        result.sort((a, b) -> {
            LocalDate d1 = (LocalDate) a.get("promisedDate");
            LocalDate d2 = (LocalDate) b.get("promisedDate");
            if (d1 == null || d2 == null) return 0;
            return d2.compareTo(d1);
        });
        return result;
    }

    public List<Map<String, Object>> forAllOrgs() {
        List<Account> accounts = accountRepository.findAll();
        if (accounts.isEmpty()) {
            return List.of();
        }
        Map<Long, Account> accountMap = accounts.stream().collect(Collectors.toMap(Account::getId, a -> a));
        Map<Long, String> allUserNames = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, u -> u.getName() != null ? u.getName() : u.getEmail(), (a, b) -> a));
        List<Ptp> ptps = ptpRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Ptp p : ptps) {
            Account acc = accountMap.get(p.getAccountId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("accountId", p.getAccountId());
            m.put("accountName", acc != null ? acc.getName() : "Account #" + p.getAccountId());
            m.put("contactEmail", acc != null ? acc.getContactEmail() : null);
            m.put("contactPhone", acc != null ? acc.getContactPhone() : null);
            m.put("ownershipMode", acc != null ? acc.getOwnershipMode() : "direct");
            m.put("relationshipOwnerId", acc != null ? acc.getRelationshipOwnerId() : null);
            m.put("relationshipOwnerName", acc != null && acc.getRelationshipOwnerId() != null ? allUserNames.get(acc.getRelationshipOwnerId()) : null);
            m.put("promisedAmount", p.getPromisedAmount());
            m.put("promisedDate", p.getPromisedDate());
            m.put("status", p.getStatus() != null ? p.getStatus().name() : null);
            m.put("createdBy", p.getCreatedBy());
            m.put("createdByName", p.getCreatedBy() != null ? allUserNames.get(p.getCreatedBy()) : null);
            m.put("createdAt", p.getCreatedAt());
            result.add(m);
        }
        result.sort((a, b) -> {
            LocalDate d1 = (LocalDate) a.get("promisedDate");
            LocalDate d2 = (LocalDate) b.get("promisedDate");
            if (d1 == null || d2 == null) return 0;
            return d2.compareTo(d1);
        });
        return result;
    }

    public Ptp updateStatus(Long ptpId, PtpStatus status, Long orgId) {
        return updateStatus(ptpId, status, orgId, null, null);
    }

    public Ptp updateStatus(Long ptpId, PtpStatus status, Long orgId, String userRole, Long userId) {
        Ptp ptp = ptpRepository.findById(ptpId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Promise to pay not found"));
        Account acc = accountRepository.findById(ptp.getAccountId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        if (orgId != null && !acc.getOrgId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "PTP not in your organization");
        }
        if (userRole != null) {
            if ("collector".equalsIgnoreCase(userRole)) {
                if (acc.getRelationshipOwnerId() != null || "indirect".equalsIgnoreCase(acc.getOwnershipMode())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Collectors cannot update promise-to-pay status for accounts assigned to relationship owners.");
                }
                if (acc.getAssignedCollectorId() == null || !acc.getAssignedCollectorId().equals(userId)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Collectors can only update promise-to-pay status for accounts in their assigned portfolio.");
                }
            } else if ("relationship_owner".equalsIgnoreCase(userRole)) {
                if (acc.getRelationshipOwnerId() == null || !acc.getRelationshipOwnerId().equals(userId)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Relationship owners can only update promise-to-pay status for accounts in their assigned portfolio.");
                }
            }
        }
        ptp.setStatus(status);
        ptp = ptpRepository.save(ptp);
        if (status == PtpStatus.kept || status == PtpStatus.broken) {
            outcomeEventService.recordEvent(ptp.getAccountId(),
                    status == PtpStatus.kept ? "ptp_kept" : "ptp_broken", null, ptp.getId());
        }
        recompute(ptp.getAccountId());
        return ptp;
    }

    /** P0.3 #10 -- real-time recompute whenever a PTP changes for the account. */
    private void recompute(Long accountId) {
        try {
            accountRepository.findById(accountId)
                    .ifPresent(a -> scoringService.computeAccountScore(accountId, a.getOrgId()));
        } catch (Exception e) {
            log.error("Failed to recompute score for account {}: {}", accountId, e.getMessage(), e);
        }
    }
}
