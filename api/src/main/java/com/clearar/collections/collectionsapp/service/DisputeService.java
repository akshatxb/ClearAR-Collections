package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Dispute;
import com.clearar.collections.collectionsapp.entity.DisputeStatus;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.InvoiceStatus;
import com.clearar.collections.collectionsapp.entity.ReasonCode;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.DisputeRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.ReasonCodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** P0.4 #17 + P1 #36 -- dispute creation/tracking, resolution requires a reason code -> outcome event. */
@Service
@RequiredArgsConstructor
public class DisputeService {

    private final DisputeRepository disputeRepository;
    private final OutcomeEventService outcomeEventService;
    private final AccountRepository accountRepository;
    private final ScoringService scoringService;
    private final ReasonCodeRepository reasonCodeRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceService invoiceService;
    private final EmailService emailService;

    public Dispute create(Long accountId, String reason, Long createdBy, boolean customerOrigin) {
        return create(accountId, reason, createdBy, customerOrigin, null, null);
    }

    public Dispute create(Long accountId, String reason, Long createdBy, boolean customerOrigin, Long invoiceId, Long reasonCodeId) {
        if (invoiceId != null) {
            Invoice inv = invoiceRepository.findById(invoiceId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice not found"));
            if (!inv.getAccountId().equals(accountId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice does not belong to specified account");
            }
            if (inv.getStatus() == InvoiceStatus.paid) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot dispute an already paid invoice");
            }
            if (inv.getStatus() == InvoiceStatus.written_off) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot dispute a written-off invoice");
            }
            inv.setStatus(InvoiceStatus.disputed);
            invoiceRepository.save(inv);
        }

        Dispute d = Dispute.builder()
                .accountId(accountId)
                .invoiceId(invoiceId)
                .reason(reason)
                .reasonCodeId(reasonCodeId)
                .status(DisputeStatus.open)
                .createdBy(createdBy)
                .customerOrigin(customerOrigin)
                .build();
        d = disputeRepository.save(d);

        recompute(accountId);

        // Send Dispute Opened Acknowledgement Email
        try {
            final Dispute savedDispute = d;
            accountRepository.findById(accountId)
                    .ifPresent(account -> emailService.sendDisputeOpened(account, savedDispute));
        } catch (Exception e) {
            // Non-blocking for dispute creation transaction
        }

        return d;
    }

    public List<Dispute> forAccount(Long accountId) {
        return disputeRepository.findByAccountId(accountId);
    }

    public List<Map<String, Object>> forOrg(Long orgId) {
        List<Account> accounts = accountRepository.findByOrgId(orgId);
        if (accounts.isEmpty()) {
            return List.of();
        }
        Map<Long, Account> accountMap = accounts.stream().collect(Collectors.toMap(Account::getId, a -> a));
        List<Dispute> disputes = disputeRepository.findByAccountIdInOrderByCreatedAtDesc(new ArrayList<>(accountMap.keySet()));
        Map<Long, ReasonCode> reasonCodeMap = reasonCodeRepository.findAll().stream()
                .collect(Collectors.toMap(ReasonCode::getId, r -> r, (a, b) -> a));

        return disputes.stream().map(d -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", d.getId());
            map.put("accountId", d.getAccountId());
            map.put("invoiceId", d.getInvoiceId());
            Account acc = accountMap.get(d.getAccountId());
            map.put("accountName", acc != null ? acc.getName() : "Unknown");
            map.put("contactEmail", acc != null ? acc.getContactEmail() : null);
            map.put("reason", d.getReason());
            map.put("status", d.getStatus().name());
            map.put("createdBy", d.getCreatedBy());
            map.put("customerOrigin", d.isCustomerOrigin());
            map.put("reasonCodeId", d.getReasonCodeId());
            if (d.getReasonCodeId() != null && reasonCodeMap.containsKey(d.getReasonCodeId())) {
                map.put("reasonCodeLabel", reasonCodeMap.get(d.getReasonCodeId()).getLabel());
            }
            map.put("createdAt", d.getCreatedAt());
            map.put("resolvedAt", d.getResolvedAt());
            long daysOpen = 0;
            Instant end = d.getResolvedAt() != null ? d.getResolvedAt() : Instant.now();
            if (d.getCreatedAt() != null) {
                daysOpen = java.time.Duration.between(d.getCreatedAt(), end).toDays();
            }
            map.put("daysOpen", daysOpen);
            return map;
        }).collect(Collectors.toList());
    }

    public Dispute update(Long disputeId, String status, Long reasonCodeId, Long orgId) {
        return update(disputeId, status, reasonCodeId, orgId, null);
    }

    public Dispute update(Long disputeId, String status, Long reasonCodeId, Long orgId, com.clearar.collections.collectionsapp.security.AuthenticatedUser user) {
        Dispute d = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dispute not found"));

        Account account = accountRepository.findById(d.getAccountId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        if (!account.getOrgId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Dispute not in your organization");
        }
        if (user != null && "collector".equalsIgnoreCase(user.getRole())) {
            if (account.getAssignedCollectorId() == null || !account.getAssignedCollectorId().equals(user.getUserId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: collectors can only update disputes for accounts in their assigned portfolio.");
            }
        }

        DisputeStatus oldStatus = d.getStatus();
        DisputeStatus newStatus;
        try {
            newStatus = DisputeStatus.valueOf(status);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status");
        }

        if (newStatus == DisputeStatus.resolved && oldStatus != DisputeStatus.resolved) {
            if (reasonCodeId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reasonCodeId required to resolve a dispute");
            }
            d.setResolvedAt(Instant.now());
            d.setReasonCodeId(reasonCodeId);

            if (d.getInvoiceId() != null) {
                Long invId = d.getInvoiceId();
                boolean otherDisputesOpen = disputeRepository.findByAccountId(d.getAccountId()).stream()
                        .anyMatch(other -> !other.getId().equals(disputeId)
                                && invId.equals(other.getInvoiceId())
                                && other.getStatus() != DisputeStatus.resolved);
                if (!otherDisputesOpen) {
                    invoiceRepository.findById(invId).ifPresent(inv -> {
                        if (inv.getStatus() == InvoiceStatus.disputed) {
                            BigDecimal remaining = invoiceService.getRemainingBalance(inv);
                            if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
                                inv.setStatus(InvoiceStatus.paid);
                            } else {
                                inv.setStatus(InvoiceStatus.open);
                            }
                            invoiceRepository.save(inv);
                        }
                    });
                }
            }
        } else if (oldStatus == DisputeStatus.resolved && newStatus != DisputeStatus.resolved) {
            // Reopening a resolved dispute
            d.setResolvedAt(null);
            if (d.getInvoiceId() != null) {
                invoiceRepository.findById(d.getInvoiceId()).ifPresent(inv -> {
                    if (inv.getStatus() != InvoiceStatus.paid && inv.getStatus() != InvoiceStatus.written_off) {
                        inv.setStatus(InvoiceStatus.disputed);
                        invoiceRepository.save(inv);
                    }
                });
            }
        }

        d.setStatus(newStatus);
        d = disputeRepository.save(d);

        if (newStatus == DisputeStatus.resolved && oldStatus != DisputeStatus.resolved) {
            outcomeEventService.recordEvent(d.getAccountId(), "dispute_resolved", reasonCodeId, d.getId());
            try {
                final Dispute resolvedDispute = d;
                String reasonLabel = reasonCodeId != null
                        ? reasonCodeRepository.findById(reasonCodeId).map(ReasonCode::getLabel).orElse(null)
                        : null;
                emailService.sendDisputeResolved(account, resolvedDispute, reasonLabel);
            } catch (Exception e) {
                // Non-blocking for dispute resolution transaction
            }
        }
        recompute(d.getAccountId());
        return d;
    }

    /** P0.3 #10 -- real-time recompute whenever a dispute changes for the account. */
    private void recompute(Long accountId) {
        accountRepository.findById(accountId)
                .ifPresent(a -> scoringService.computeAccountScore(accountId, a.getOrgId()));
    }
}
