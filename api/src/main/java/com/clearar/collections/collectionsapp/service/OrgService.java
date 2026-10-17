package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.dto.WeightSuggestion;
import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/** P0.7 -- manager team-wide dashboard + priority factor configuration. */
@Service
@RequiredArgsConstructor
public class OrgService {

    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final AccountScoreRepository accountScoreRepository;
    private final PriorityFactorRepository priorityFactorRepository;
    private final ScoringService scoringService;
    private final OutcomeEventRepository outcomeEventRepository;
    private final ReasonCodeRepository reasonCodeRepository;
    private final FeedbackAnalysisService feedbackAnalysisService;
    private final OrganizationRepository organizationRepository;
    private final EscalationService escalationService;
    private final PtpService ptpService;
    private final InvoiceService invoiceService;

    /** #21 -- aggregate cards: total open balance, count by aging bucket, avg priority score, cash collected. */
    public Map<String, Object> dashboard(Long orgId) {
        Organization org = organizationRepository.findById(orgId).orElse(null);
        String orgName = org != null ? org.getName() : ("Organization #" + orgId);

        List<Account> accounts = accountRepository.findByOrgId(orgId);

        BigDecimal totalOpenBalance = BigDecimal.ZERO;
        Map<String, Integer> countByBucket = new LinkedHashMap<>();
        for (String b : List.of("current", "0-30", "31-60", "61-90", "90+")) countByBucket.put(b, 0);

        Map<String, BigDecimal> amountByBucket = new LinkedHashMap<>();
        for (String b : List.of("current", "0-30", "31-60", "61-90", "90+")) amountByBucket.put(b, BigDecimal.ZERO);

        double scoreSum = 0;
        int scoreCount = 0;

        List<Long> allAccountIds = accounts.stream().map(Account::getId).toList();
        List<Invoice> allInvoices = allAccountIds.isEmpty() ? List.of() : invoiceRepository.findByAccountIdIn(allAccountIds);
        Map<Long, List<Invoice>> invoicesByAccount = allInvoices.stream()
                .collect(Collectors.groupingBy(Invoice::getAccountId));
        Map<Long, BigDecimal> remainingBalances = invoiceService.getRemainingBalances(allInvoices);

        for (Account acc : accounts) {
            List<Invoice> invoices = invoicesByAccount.getOrDefault(acc.getId(), List.of());
            totalOpenBalance = totalOpenBalance.add(sumOpen(invoices));

            String bucket = worstBucket(invoices);
            countByBucket.merge(bucket, 1, Integer::sum);

            Optional<AccountScore> score = accountScoreRepository.findTopByAccountIdOrderByComputedAtDesc(acc.getId());
            if (score.isPresent()) {
                scoreSum += score.get().getTotalScore();
                scoreCount++;
            }
        }

        for (Invoice inv : allInvoices) {
            BigDecimal rem = remainingBalances.getOrDefault(inv.getId(), inv.getAmount());
            boolean open = inv.getStatus() != InvoiceStatus.paid && inv.getStatus() != InvoiceStatus.written_off && rem.signum() > 0;
            if (open) {
                String bucket = ScoringService.agingBucket(inv.getDueDate());
                amountByBucket.merge(bucket, rem, BigDecimal::add);
            }
        }

        // Cash collected metrics from payments
        List<Long> allInvoiceIds = allInvoices.stream().map(Invoice::getId).toList();
        List<Payment> allPayments = allInvoiceIds.isEmpty() ? List.of() : paymentRepository.findByInvoiceIdIn(allInvoiceIds);

        LocalDate today = LocalDate.now();
        LocalDate firstOfMonth = today.withDayOfMonth(1);

        BigDecimal cashCollectedMtd = allPayments.stream()
                .filter(p -> p.getPaidDate() != null && !p.getPaidDate().isBefore(firstOfMonth))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal cashCollectedToday = allPayments.stream()
                .filter(p -> p.getPaidDate() != null && p.getPaidDate().isEqual(today))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCashCollected = allPayments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orgId", orgId);
        result.put("orgName", orgName);
        result.put("totalAccounts", accounts.size());
        result.put("totalOpenBalance", totalOpenBalance);
        result.put("countByAgingBucket", countByBucket);
        result.put("amountByAgingBucket", amountByBucket);
        result.put("avgPriorityScore", scoreCount == 0 ? 0 : scoreSum / scoreCount);
        result.put("cashCollectedMtd", cashCollectedMtd);
        result.put("cashCollectedToday", cashCollectedToday);
        result.put("totalCashCollected", totalCashCollected);
        return result;
    }

    /** #22 -- GET current factor weights (ensuring all 7 factors exist). */
    public List<PriorityFactor> getFactors(Long orgId) {
        return scoringService.ensureAllFactors(orgId);
    }

    /**
     * #22 -- PATCH weights, then immediately recompute every account's score in this org so the
     * worklist reorders in real time (the live-demo moment). Previously this method only saved
     * the new weights and left recompute to whichever unrelated invoice/payment/PTP/dispute event
     * happened to fire next -- meaning a weight change alone never reordered the worklist. Each
     * call inserts a fresh AccountScore row per account (consistent with P1 #37 score history).
     */
    public List<PriorityFactor> updateFactors(Long orgId, List<com.clearar.collections.collectionsapp.dto.PriorityFactorUpdateRequest.Item> updates) {
        List<PriorityFactor> factors = priorityFactorRepository.findByOrgIdAndActiveTrue(orgId);
        Map<Long, PriorityFactor> byId = new HashMap<>();
        for (PriorityFactor f : factors) byId.put(f.getId(), f);

        for (com.clearar.collections.collectionsapp.dto.PriorityFactorUpdateRequest.Item update : updates) {
            PriorityFactor f = byId.get(update.getId());
            if (f != null && f.getOrgId().equals(orgId) && update.getWeight() != null) {
                f.setWeight(update.getWeight());
            }
        }
        List<PriorityFactor> saved = priorityFactorRepository.saveAll(byId.values());

        for (Account acc : accountRepository.findByOrgId(orgId)) {
            scoringService.computeAccountScore(acc.getId(), orgId);
        }

        return saved;
    }

    /** P1 #27 -- outcome analytics: group outcome_events for this org by reason code (+ event type). */
    public Map<String, Object> outcomeStats(Long orgId) {
        List<Long> accountIds = accountRepository.findByOrgId(orgId).stream()
                .map(Account::getId).collect(Collectors.toList());
        List<OutcomeEvent> events = outcomeEventRepository.findByAccountIdIn(accountIds);
        Map<Long, ReasonCode> reasonCodesById = reasonCodeRepository.findAll().stream()
                .collect(Collectors.toMap(ReasonCode::getId, rc -> rc));

        Map<String, Integer> byReasonCode = new LinkedHashMap<>();
        Map<String, Integer> byEventType = new LinkedHashMap<>();
        for (OutcomeEvent event : events) {
            byEventType.merge(event.getEventType(), 1, Integer::sum);
            String label = event.getReasonCodeId() == null ? "(none)"
                    : Optional.ofNullable(reasonCodesById.get(event.getReasonCodeId()))
                            .map(ReasonCode::getLabel).orElse("(unknown reason code)");
            byReasonCode.merge(label, 1, Integer::sum);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalEvents", events.size());
        result.put("byReasonCode", byReasonCode);
        result.put("byEventType", byEventType);
        return result;
    }

    /** P1 #28 -- run the feedback analysis job on-demand and return weight suggestions. */
    public List<WeightSuggestion> weightSuggestions(Long orgId) {
        return feedbackAnalysisService.analyzeFactorAccuracy(orgId);
    }

    /** P1 #32 -- current SLA escalation rules (seeded with defaults if none configured yet). */
    public List<EscalationRule> escalationRules(Long orgId) {
        return escalationService.getRules(orgId);
    }

    /** P1 #34 -- escalation history log for this org. */
    public List<EscalationEvent> escalationHistory(Long orgId) {
        return escalationService.history(orgId);
    }

    /** P1 #35 -- PTPs due within 24h across the org, for a dashboard banner/notification. */
    public List<Ptp> ptpAlerts(Long orgId) {
        return ptpAlerts(orgId, null);
    }

    public List<Ptp> ptpAlerts(Long orgId, com.clearar.collections.collectionsapp.security.AuthenticatedUser user) {
        List<Account> accounts = accountRepository.findByOrgId(orgId);
        if (user != null && "collector".equalsIgnoreCase(user.getRole())) {
            accounts = accounts.stream()
                    .filter(a -> user.getUserId().equals(a.getAssignedCollectorId()))
                    .collect(Collectors.toList());
        }
        List<Long> accountIds = accounts.stream()
                .map(Account::getId).collect(Collectors.toList());
        return ptpService.dueSoon(accountIds);
    }

    /**
     * P1 #44 -- org-wide reporting (DSO, CEI, aging trend). {@code periodDays} defines the
     * window used for credit sales / DSO (defaults to 30 if null or non-positive).
     * DSO = (total_receivables / total_credit_sales) * number_of_days.
     * CEI = (beginning_receivables + credit_sales - ending_total_receivables)
     *       / (beginning_receivables + credit_sales - ending_current_receivables) * 100,
     * where "current receivables" is the not-yet-due (aging bucket "current") slice of the total.
     * beginning_receivables is derived rather than stored: ending - creditSales + paymentsInPeriod.
     */
    public Map<String, Object> orgReport(Long orgId, Integer periodDays) {
        int days = (periodDays == null || periodDays <= 0) ? 30 : periodDays;
        java.time.LocalDate periodStart = java.time.LocalDate.now().minusDays(days);

        List<Account> accounts = accountRepository.findByOrgId(orgId);
        List<Invoice> allInvoices = new ArrayList<>();
        Map<String, Integer> countByBucket = new LinkedHashMap<>();
        Map<String, BigDecimal> amountByBucket = new LinkedHashMap<>();
        for (String b : List.of("current", "0-30", "31-60", "61-90", "90+")) {
            countByBucket.put(b, 0);
            amountByBucket.put(b, BigDecimal.ZERO);
        }

        BigDecimal endingTotalReceivables = BigDecimal.ZERO;
        BigDecimal endingCurrentReceivables = BigDecimal.ZERO;
        BigDecimal creditSales = BigDecimal.ZERO;

        for (Account acc : accounts) {
            List<Invoice> invoices = invoiceRepository.findByAccountId(acc.getId());
            allInvoices.addAll(invoices);
        }

        Map<Long, BigDecimal> remainingBalances = invoiceService.getRemainingBalances(allInvoices);

        for (Invoice inv : allInvoices) {
            BigDecimal rem = remainingBalances.getOrDefault(inv.getId(), inv.getAmount());
            boolean open = inv.getStatus() != InvoiceStatus.paid && inv.getStatus() != InvoiceStatus.written_off && rem.signum() > 0;
            if (open) {
                endingTotalReceivables = endingTotalReceivables.add(rem);
                String bucket = ScoringService.agingBucket(inv.getDueDate());
                if ("current".equals(bucket)) {
                    endingCurrentReceivables = endingCurrentReceivables.add(rem);
                }
                countByBucket.merge(bucket, 1, Integer::sum);
                amountByBucket.merge(bucket, rem, BigDecimal::add);
            }
            if (inv.getIssuedDate() != null && !inv.getIssuedDate().isBefore(periodStart)) {
                creditSales = creditSales.add(inv.getAmount());
            }
        }

        List<Long> invoiceIds = allInvoices.stream().map(Invoice::getId).toList();
        BigDecimal paymentsInPeriod = invoiceIds.isEmpty() ? BigDecimal.ZERO :
                paymentRepository.findByInvoiceIdIn(invoiceIds).stream()
                        .filter(p -> p.getPaidDate() != null && !p.getPaidDate().isBefore(periodStart))
                        .map(Payment::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal beginningReceivables = endingTotalReceivables.subtract(creditSales).add(paymentsInPeriod);
        if (beginningReceivables.signum() < 0) beginningReceivables = BigDecimal.ZERO;

        java.math.BigDecimal dso = BigDecimal.ZERO;
        if (creditSales.signum() > 0) {
            dso = endingTotalReceivables.divide(creditSales, 6, java.math.RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(days));
        }

        BigDecimal ceiNumerator = beginningReceivables.add(creditSales).subtract(endingTotalReceivables);
        BigDecimal ceiDenominator = beginningReceivables.add(creditSales).subtract(endingCurrentReceivables);
        BigDecimal cei = BigDecimal.ZERO;
        if (ceiDenominator.signum() > 0) {
            cei = ceiNumerator.divide(ceiDenominator, 6, java.math.RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("periodDays", days);
        result.put("dso", dso.setScale(1, java.math.RoundingMode.HALF_UP));
        result.put("cei", cei.setScale(1, java.math.RoundingMode.HALF_UP));
        result.put("endingTotalReceivables", endingTotalReceivables);
        result.put("endingCurrentReceivables", endingCurrentReceivables);
        result.put("beginningReceivables", beginningReceivables);
        result.put("creditSalesInPeriod", creditSales);
        result.put("paymentsInPeriod", paymentsInPeriod);
        result.put("agingTrendByCount", countByBucket);
        result.put("agingTrendByAmount", amountByBucket);
        return result;
    }

    private BigDecimal sumOpen(List<Invoice> invoices) {
        return invoiceService.calculateOpenBalance(invoices);
    }

    private String worstBucket(List<Invoice> invoices) {
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
