package com.clearar.collections.collectionsapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.clearar.collections.collectionsapp.dto.ScoreFactorItem;
import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.stereotype.Service;


import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * P0.3 -- Explainable, weighted, named-factor scoring model.
 * Factors: overdue_days, broken_ptp_count, invoice_value, dispute_count.
 * Recomputed synchronously whenever an invoice/payment/PTP/dispute changes for
 * an account
 * (no queue needed at this scale).
 */
@Service
@RequiredArgsConstructor
public class ScoringService {

    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final PtpRepository ptpRepository;
    private final DisputeRepository disputeRepository;
    private final PriorityFactorRepository priorityFactorRepository;
    private final AccountScoreRepository accountScoreRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Recomputes and persists a new AccountScore row (P1 #37: history via insert-not-overwrite).
     * Incorporates both risk penalties (direction +1) and mitigating/trust credits (direction -1),
     * including Active PTP Grace suppression, PTP kept reliability ratio, and recent payment credit.
     */
    @SneakyThrows
    public AccountScore computeAccountScore(Long accountId, Long orgId) {
        List<Invoice> invoices = invoiceRepository.findByAccountId(accountId);
        List<Ptp> ptps = ptpRepository.findByAccountId(accountId);
        List<Dispute> disputes = disputeRepository.findByAccountId(accountId);

        // Dollar-weighted days past due (DPD) to avoid single-invoice outlier distortion
        double weightedDpd = computeWeightedDpd(invoices);

        // Open balance across active unpaid invoices
        BigDecimal openInvoiceValue = computeOpenInvoiceValue(invoices);

        // PTP statistics: broken, active/pending grace, kept ratio
        long brokenPtpCount = ptps.stream().filter(p -> p.getStatus() == PtpStatus.broken).count();
        long activePtpCount = ptps.stream()
                .filter(p -> p.getStatus() == PtpStatus.pending
                        && (p.getPromisedDate() == null || !p.getPromisedDate().isBefore(LocalDate.now())))
                .count();
        long keptPtpCount = ptps.stream().filter(p -> p.getStatus() == PtpStatus.kept).count();
        long resolvedPtpCount = keptPtpCount + brokenPtpCount;
        double ptpKeptRatio = resolvedPtpCount > 0 ? (double) keptPtpCount / resolvedPtpCount : 0.0;

        // Open disputes
        long openDisputeCount = disputes.stream()
                .filter(d -> d.getStatus() != DisputeStatus.resolved)
                .count();

        // Recent cash collections (last 14 days)
        double recentPaymentKValue = computeRecentPaymentsK(invoices);

        List<PriorityFactor> weights = ensureAllFactors(orgId);

        List<ScoreFactorItem> breakdown = new ArrayList<>();
        double total = 0.0;

        for (PriorityFactor factor : weights) {
            double rawValue = switch (factor.getFactorKey()) {
                case "overdue_days" -> weightedDpd;
                case "invoice_value" -> openInvoiceValue.doubleValue();
                case "broken_ptp_count" -> brokenPtpCount;
                case "dispute_count" -> openDisputeCount;
                case "active_ptp_grace" -> activePtpCount;
                case "ptp_kept_ratio" -> ptpKeptRatio;
                case "recent_payment_value" -> recentPaymentKValue;
                default -> 0.0;
            };

            // Standardize normalized values so all factor weights function harmoniously on a 0.0 - 5.0 scale
            // Logarithmic dampening on monetary values prevents extreme outlier invoices (e.g. $1T) from blowing up the score.
            double normalized = switch (factor.getFactorKey()) {
                case "overdue_days" -> Math.min(8.0, weightedDpd / 30.0); // 30 days DPD = ~1.0 normalized unit, capped at 8.0 (~240 days)
                case "invoice_value" -> {
                    double val = Math.max(0.0, openInvoiceValue.doubleValue());
                    // Log-dampened scale: $10k = ~1.04, $100k = ~2.0, $1M = ~3.0, with an upper saturation ceiling of 10.0
                    yield val <= 0.0 ? 0.0 : Math.min(10.0, Math.log10(1.0 + val / 1000.0));
                }
                case "broken_ptp_count" -> Math.min(10.0, brokenPtpCount * 2.0); // broken commitment is a strong risk event
                case "dispute_count" -> Math.min(10.0, openDisputeCount * 1.5);
                case "active_ptp_grace" -> Math.min(10.0, activePtpCount * 4.0); // active promise gives immediate meaningful relief
                case "ptp_kept_ratio" -> ptpKeptRatio * 5.0; // high fulfillment delivers strong trust credit
                case "recent_payment_value" -> {
                    double payVal = Math.max(0.0, recentPaymentKValue * 1000.0);
                    yield payVal <= 0.0 ? 0.0 : Math.min(8.0, Math.log10(1.0 + payVal / 1000.0));
                }
                default -> rawValue;
            };

            int direction = factor.getEffectiveDirection();
            double contribution = direction * normalized * factor.getWeight();
            total += contribution;
            breakdown.add(new ScoreFactorItem(factor.getFactorKey(), rawValue, contribution, direction));
        }

        // Clamp total score to sensible non-negative range [0.0, 100.0]
        double boundedTotal = Math.max(0.0, Math.min(100.0, Math.round(total * 10.0) / 10.0));

        AccountScore score = AccountScore.builder()
                .accountId(accountId)
                .totalScore(boundedTotal)
                .breakdownJson(objectMapper.writeValueAsString(breakdown))
                .build();

        return accountScoreRepository.save(score);
    }

    /**
     * Calculates dollar-weighted Days Past Due (DPD) across all open unpaid invoices.
     * Prevents small stale invoices (e.g. $20 at 120 days) from dominating large delinquent accounts.
     */
    public double computeWeightedDpd(List<Invoice> invoices) {
        if (invoices == null || invoices.isEmpty()) return 0.0;

        List<Invoice> openInvoices = invoices.stream()
                .filter(i -> i.getStatus() != InvoiceStatus.paid && i.getStatus() != InvoiceStatus.written_off)
                .toList();
        if (openInvoices.isEmpty()) return 0.0;

        Map<Long, BigDecimal> remainingBalances = computeRemainingBalances(openInvoices);
        double totalBalance = 0.0;
        double weightedDaysSum = 0.0;

        LocalDate today = LocalDate.now();
        for (Invoice inv : openInvoices) {
            BigDecimal bal = remainingBalances.getOrDefault(inv.getId(), inv.getAmount());
            if (bal.signum() <= 0) continue;

            double balDouble = bal.doubleValue();
            totalBalance += balDouble;
            if (inv.getDueDate() != null && inv.getDueDate().isBefore(today)) {
                long days = java.time.temporal.ChronoUnit.DAYS.between(inv.getDueDate(), today);
                weightedDaysSum += (days * balDouble);
            }
        }

        return totalBalance > 0 ? (weightedDaysSum / totalBalance) : 0.0;
    }

    /**
     * Computes total open balance for active unpaid invoices.
     */
    public BigDecimal computeOpenInvoiceValue(List<Invoice> invoices) {
        if (invoices == null || invoices.isEmpty()) return BigDecimal.ZERO;
        List<Invoice> openInvoices = invoices.stream()
                .filter(i -> i.getStatus() != InvoiceStatus.paid && i.getStatus() != InvoiceStatus.written_off)
                .toList();
        if (openInvoices.isEmpty()) return BigDecimal.ZERO;

        Map<Long, BigDecimal> remainingMap = computeRemainingBalances(openInvoices);
        BigDecimal total = BigDecimal.ZERO;
        for (BigDecimal rem : remainingMap.values()) {
            if (rem.signum() > 0) {
                total = total.add(rem);
            }
        }
        return total;
    }

    /**
     * Computes payments made on this account's invoices within the last 14 days (in $k).
     */
    public double computeRecentPaymentsK(List<Invoice> invoices) {
        if (invoices == null || invoices.isEmpty()) return 0.0;
        List<Long> ids = invoices.stream().map(Invoice::getId).toList();
        LocalDate twoWeeksAgo = LocalDate.now().minusDays(14);

        List<Payment> recentPayments = paymentRepository.findByInvoiceIdIn(ids).stream()
                .filter(p -> p.getPaidDate() != null && !p.getPaidDate().isBefore(twoWeeksAgo))
                .toList();

        BigDecimal sum = recentPayments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return sum.doubleValue() / 1000.0;
    }

    private Map<Long, BigDecimal> computeRemainingBalances(List<Invoice> openInvoices) {
        List<Long> ids = openInvoices.stream().map(Invoice::getId).toList();
        Map<Long, BigDecimal> paidByInvoice = new HashMap<>();
        for (Payment p : paymentRepository.findByInvoiceIdIn(ids)) {
            paidByInvoice.merge(p.getInvoiceId(), p.getAmount(), BigDecimal::add);
        }
        Map<Long, BigDecimal> remaining = new HashMap<>();
        for (Invoice inv : openInvoices) {
            BigDecimal rem = inv.getAmount().subtract(paidByInvoice.getOrDefault(inv.getId(), BigDecimal.ZERO));
            remaining.put(inv.getId(), rem.signum() > 0 ? rem : BigDecimal.ZERO);
        }
        return remaining;
    }

    @SneakyThrows
    public List<ScoreFactorItem> parseBreakdown(String json) {
        return objectMapper.readValue(json, objectMapper.getTypeFactory()
                .constructCollectionType(List.class, ScoreFactorItem.class));
    }

    /**
     * Seeds balanced 7-factor model with standardized 0.0 - 5.0 weights and explicit directions.
     */
    public List<PriorityFactor> defaultFactors(Long orgId) {
        List<PriorityFactor> defaults = List.of(
                PriorityFactor.builder().orgId(orgId).factorKey("overdue_days").label("Days Overdue (Weighted DPD)")
                        .weight(1.5).direction(1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("invoice_value").label("Open Balance ($k)")
                        .weight(1.5).direction(1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("broken_ptp_count").label("Broken Promises-to-Pay")
                        .weight(2.0).direction(1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("dispute_count").label("Open Disputes")
                        .weight(1.0).direction(1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("active_ptp_grace").label("Active PTP Grace (Relief)")
                        .weight(2.5).direction(-1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("ptp_kept_ratio").label("PTP Kept Ratio (Reliability)")
                        .weight(1.5).direction(-1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("recent_payment_value").label("Recent Payments ($k)")
                        .weight(1.0).direction(-1).active(true).build());
        return priorityFactorRepository.saveAll(defaults);
    }

    /**
     * Ensures all 7 factors exist with correct direction and normalized weights <= 5.0 for an org.
     */
    public List<PriorityFactor> ensureAllFactors(Long orgId) {
        List<PriorityFactor> existing = priorityFactorRepository.findByOrgIdAndActiveTrue(orgId);
        if (existing.isEmpty()) {
            return defaultFactors(orgId);
        }

        Map<String, PriorityFactor> existingByKey = new HashMap<>();
        boolean modified = false;

        for (PriorityFactor pf : existing) {
            existingByKey.put(pf.getFactorKey(), pf);
            // Fix direction if null or zero (MySQL default)
            if (pf.getDirection() == null || pf.getDirection() == 0) {
                pf.setDirection(isMitigatingFactor(pf.getFactorKey()) ? -1 : 1);
                modified = true;
            }
            // Normalize legacy weights > 5.0 to stay within the standard 0.0 - 5.0 slider range
            if (pf.getWeight() != null && pf.getWeight() > 5.0) {
                if ("broken_ptp_count".equals(pf.getFactorKey())) pf.setWeight(2.0);
                else if ("dispute_count".equals(pf.getFactorKey())) pf.setWeight(1.0);
                else pf.setWeight(Math.min(5.0, Math.round(pf.getWeight() / 3.0 * 10.0) / 10.0));
                modified = true;
            }
        }

        List<PriorityFactor> defaults = defaultFactorsList(orgId);
        List<PriorityFactor> toAdd = new ArrayList<>();
        for (PriorityFactor def : defaults) {
            if (!existingByKey.containsKey(def.getFactorKey())) {
                toAdd.add(def);
            }
        }

        if (!toAdd.isEmpty()) {
            List<PriorityFactor> savedNew = priorityFactorRepository.saveAll(toAdd);
            for (PriorityFactor savedPf : savedNew) {
                existingByKey.put(savedPf.getFactorKey(), savedPf);
            }
        }
        if (modified) {
            priorityFactorRepository.saveAll(existing);
        }

        // Return ordered by canonical order
        List<String> canonicalOrder = List.of(
                "overdue_days", "invoice_value", "broken_ptp_count", "dispute_count",
                "active_ptp_grace", "ptp_kept_ratio", "recent_payment_value");
        List<PriorityFactor> ordered = new ArrayList<>();
        for (String k : canonicalOrder) {
            if (existingByKey.containsKey(k)) {
                ordered.add(existingByKey.get(k));
            }
        }
        return ordered;
    }

    private boolean isMitigatingFactor(String key) {
        return "active_ptp_grace".equals(key) || "ptp_kept_ratio".equals(key) || "recent_payment_value".equals(key);
    }

    private List<PriorityFactor> defaultFactorsList(Long orgId) {
        return List.of(
                PriorityFactor.builder().orgId(orgId).factorKey("overdue_days").label("Days Overdue (Weighted DPD)")
                        .weight(1.5).direction(1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("invoice_value").label("Open Balance ($k)")
                        .weight(1.5).direction(1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("broken_ptp_count").label("Broken Promises-to-Pay")
                        .weight(2.0).direction(1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("dispute_count").label("Open Disputes")
                        .weight(1.0).direction(1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("active_ptp_grace").label("Active PTP Grace (Relief)")
                        .weight(2.5).direction(-1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("ptp_kept_ratio").label("PTP Kept Ratio (Reliability)")
                        .weight(1.5).direction(-1).active(true).build(),
                PriorityFactor.builder().orgId(orgId).factorKey("recent_payment_value").label("Recent Payments ($k)")
                        .weight(1.0).direction(-1).active(true).build());
    }

    public static String agingBucket(LocalDate dueDate) {
        if (dueDate == null || dueDate.isAfter(LocalDate.now())) {
            return "current";
        }
        long days = java.time.temporal.ChronoUnit.DAYS.between(dueDate, LocalDate.now());
        if (days <= 30)
            return "0-30";
        if (days <= 60)
            return "31-60";
        if (days <= 90)
            return "61-90";
        return "90+";
    }
}