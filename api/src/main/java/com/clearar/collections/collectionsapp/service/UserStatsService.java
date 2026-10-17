package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * P1 #40 -- GET /api/users/me/stats: count of accounts worked, PTP kept-rate, and a
 * DSO-days-reduced figure (simple delta calc, per the build spec).
 *
 * "Accounts worked" = distinct accounts this user has logged a communication or PTP against.
 * "DSO-days-reduced" = there's no counterfactual in the schema for what collection time would
 * have been without this collector's work, so as the simplest available delta: we compare the
 * average days-to-pay (payment date minus invoice issued date) on this collector's worked
 * accounts against the org-wide average days-to-pay, and multiply the per-invoice delta by how
 * many of the collector's invoices were paid. A positive number means this collector's accounts
 * are, on average, paying faster than the org as a whole.
 */
@Service
@RequiredArgsConstructor
public class UserStatsService {

    private final CommunicationRepository communicationRepository;
    private final PtpRepository ptpRepository;
    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;

    public Map<String, Object> myStats(Long userId, Long orgId) {
        Set<Long> orgAccountIds = accountRepository.findByOrgId(orgId).stream()
                .map(Account::getId).collect(Collectors.toSet());

        Set<Long> workedAccountIds = new HashSet<>();
        communicationRepository.findByCreatedBy(userId).forEach(c -> workedAccountIds.add(c.getAccountId()));
        List<Ptp> userPtps = ptpRepository.findByCreatedBy(userId);
        userPtps.forEach(p -> workedAccountIds.add(p.getAccountId()));
        workedAccountIds.retainAll(orgAccountIds); // never count another org's accounts

        long kept = userPtps.stream().filter(p -> p.getStatus() == PtpStatus.kept).count();
        long broken = userPtps.stream().filter(p -> p.getStatus() == PtpStatus.broken).count();
        Double ptpKeptRate = (kept + broken) == 0 ? null : (double) kept / (kept + broken);

        double avgDaysUser = avgDaysToPay(new ArrayList<>(workedAccountIds));
        double avgDaysOrg = avgDaysToPay(new ArrayList<>(orgAccountIds));
        long userPaidInvoiceCount = paidInvoiceCount(new ArrayList<>(workedAccountIds));
        double perInvoiceDelta = avgDaysOrg - avgDaysUser; // positive = user's accounts pay faster than org avg
        double dsoDaysReduced = perInvoiceDelta * userPaidInvoiceCount;

        long myAssignedAccounts = accountRepository.findByOrgId(orgId).stream()
                .filter(a -> userId.equals(a.getAssignedCollectorId()) || userId.equals(a.getRelationshipOwnerId()))
                .count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("accountsWorked", workedAccountIds.size());
        result.put("assignedAccounts", myAssignedAccounts);
        result.put("ptpKept", kept);
        result.put("ptpBroken", broken);
        result.put("ptpKeptRate", ptpKeptRate);
        result.put("avgDaysToPayYourAccounts", round2(avgDaysUser));
        result.put("avgDaysToPayOrgWide", round2(avgDaysOrg));
        result.put("dsoDaysReducedEstimate", round2(dsoDaysReduced));
        return result;
    }

    /**
     * Team performance overview: aggregates performance and productivity metrics for every
     * active staff member in the organization.
     */
    public List<Map<String, Object>> teamStats(Long orgId) {
        List<User> staff = userRepository.findByOrgId(orgId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (User u : staff) {
            Map<String, Object> stats = myStats(u.getId(), orgId);
            stats.put("userId", u.getId());
            stats.put("name", u.getName() != null ? u.getName() : u.getEmail());
            stats.put("email", u.getEmail());
            stats.put("role", u.getRole() != null ? u.getRole().name() : "");
            stats.put("active", u.isActive());

            // Communication touches count
            long touches = communicationRepository.findByCreatedBy(u.getId()).size();
            stats.put("communicationsLogged", touches);

            // Directly assigned accounts count (collector or relationship owner)
            long assignedAccounts = accountRepository.findByOrgId(orgId).stream()
                    .filter(a -> u.getId().equals(a.getAssignedCollectorId()) || u.getId().equals(a.getRelationshipOwnerId()))
                    .count();
            stats.put("assignedAccounts", assignedAccounts);

            result.add(stats);
        }

        // Sort by accounts worked desc, then communications logged desc
        result.sort((a, b) -> {
            int cmp = Integer.compare(
                    (Integer) b.getOrDefault("accountsWorked", 0),
                    (Integer) a.getOrDefault("accountsWorked", 0));
            if (cmp != 0) return cmp;
            return Long.compare(
                    (Long) b.getOrDefault("communicationsLogged", 0L),
                    (Long) a.getOrDefault("communicationsLogged", 0L));
        });

        return result;
    }

    private double avgDaysToPay(List<Long> accountIds) {
        if (accountIds.isEmpty()) return 0.0;
        List<Invoice> invoices = invoiceRepository.findByAccountIdIn(accountIds);
        List<Long> invoiceIds = invoices.stream().map(Invoice::getId).collect(Collectors.toList());
        if (invoiceIds.isEmpty()) return 0.0;
        Map<Long, Invoice> invoicesById = invoices.stream().collect(Collectors.toMap(Invoice::getId, i -> i));

        List<Double> daysToPay = new ArrayList<>();
        for (Payment payment : paymentRepository.findByInvoiceIdIn(invoiceIds)) {
            Invoice invoice = invoicesById.get(payment.getInvoiceId());
            if (invoice == null) continue;
            LocalDate baseline = invoice.getIssuedDate() != null ? invoice.getIssuedDate() : invoice.getDueDate();
            long days = java.time.temporal.ChronoUnit.DAYS.between(baseline, payment.getPaidDate());
            if (days >= 0) daysToPay.add((double) days);
        }
        return daysToPay.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private long paidInvoiceCount(List<Long> accountIds) {
        if (accountIds.isEmpty()) return 0;
        return invoiceRepository.findByAccountIdIn(accountIds).stream()
                .filter(i -> i.getStatus() == InvoiceStatus.paid)
                .count();
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
