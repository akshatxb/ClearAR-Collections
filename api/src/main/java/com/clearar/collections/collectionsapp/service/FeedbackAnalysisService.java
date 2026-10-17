package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.dto.ScoreFactorItem;
import com.clearar.collections.collectionsapp.dto.WeightSuggestion;
import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.OutcomeEvent;
import com.clearar.collections.collectionsapp.entity.PriorityFactor;
import com.clearar.collections.collectionsapp.entity.ReasonCode;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.OutcomeEventRepository;
import com.clearar.collections.collectionsapp.repository.PriorityFactorRepository;
import com.clearar.collections.collectionsapp.repository.ReasonCodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * P1 #28 -- Feedback analysis job (factor accuracy). Run on-demand (button, not a real cron)
 * per the build spec. Uses the factor_snapshot JSONB captured on every outcome event (P0.5 #19)
 * to see whether each priority factor actually distinguishes accounts that end up with a "good"
 * outcome from ones that end up "bad", and suggests a weight nudge accordingly.
 *
 * Classification of an outcome event as good/bad:
 *  - ptp_kept                                              -> good
 *  - ptp_broken                                            -> bad
 *  - dispute_resolved with reason code "payment_processed" -> good
 *  - dispute_resolved with any other reason code            -> bad
 */
@Service
@RequiredArgsConstructor
public class FeedbackAnalysisService {

    private static final double MIN_MEANINGFUL_DIFF = 0.05; // relative diff below this = "not discriminating"
    private static final double MAX_ADJUST_PCT = 0.25;      // never move a weight more than +/-25% per run

    private final OutcomeEventRepository outcomeEventRepository;
    private final PriorityFactorRepository priorityFactorRepository;
    private final ReasonCodeRepository reasonCodeRepository;
    private final AccountRepository accountRepository;
    private final ScoringService scoringService;

    public List<WeightSuggestion> analyzeFactorAccuracy(Long orgId) {
        List<Long> accountIds = accountRepository.findByOrgId(orgId).stream()
                .map(Account::getId).collect(Collectors.toList());
        if (accountIds.isEmpty()) return List.of();

        List<OutcomeEvent> events = outcomeEventRepository.findByAccountIdIn(accountIds);
        Map<Long, ReasonCode> reasonCodesById = reasonCodeRepository.findAll().stream()
                .collect(Collectors.toMap(ReasonCode::getId, rc -> rc));

        // factorKey -> raw values seen just before a "good" outcome / a "bad" outcome
        Map<String, List<Double>> goodValues = new HashMap<>();
        Map<String, List<Double>> badValues = new HashMap<>();

        for (OutcomeEvent event : events) {
            Boolean good = classify(event, reasonCodesById);
            if (good == null || event.getFactorSnapshotJson() == null) continue; // unclassifiable/no snapshot

            List<ScoreFactorItem> breakdown;
            try {
                breakdown = scoringService.parseBreakdown(event.getFactorSnapshotJson());
            } catch (Exception e) {
                continue; // ignore malformed snapshots
            }
            for (ScoreFactorItem item : breakdown) {
                (good ? goodValues : badValues)
                        .computeIfAbsent(item.getFactor(), k -> new ArrayList<>())
                        .add(item.getRawValue());
            }
        }

        List<PriorityFactor> factors = scoringService.ensureAllFactors(orgId);

        List<WeightSuggestion> suggestions = new ArrayList<>();
        for (PriorityFactor factor : factors) {
            List<Double> good = goodValues.getOrDefault(factor.getFactorKey(), List.of());
            List<Double> bad = badValues.getOrDefault(factor.getFactorKey(), List.of());

            if (good.isEmpty() && bad.isEmpty()) {
                suggestions.add(new WeightSuggestion(factor.getId(), factor.getFactorKey(), factor.getLabel(),
                        factor.getWeight(), factor.getWeight(),
                        "No outcome events recorded yet for this factor -- leaving weight unchanged.",
                        0, 0));
                continue;
            }

            double avgGood = average(good);
            double avgBad = average(bad);
            double scale = Math.max(Math.max(avgGood, avgBad), 1.0); // avoid div-by-zero, normalize by magnitude
            double relDiff = (avgBad - avgGood) / scale;

            double currentWeight = factor.getWeight();
            int direction = factor.getEffectiveDirection();
            // Direction-aware alignment:
            // For risk factors (direction = +1): higher before bad outcomes -> effectiveRelDiff > 0 (predictive)
            // For relief/trust factors (direction = -1): higher before good outcomes -> (avgBad - avgGood) < 0,
            // so multiplying by -1 yields effectiveRelDiff > 0 (predictive)!
            double effectiveRelDiff = relDiff * direction;

            double suggestedWeight;
            String rationale;

            if (Math.abs(effectiveRelDiff) < MIN_MEANINGFUL_DIFF) {
                // Factor looks similar whether the outcome was good or bad -- it isn't discriminating.
                suggestedWeight = round2(Math.max(0.1, Math.min(5.0, currentWeight * (1 - MAX_ADJUST_PCT * 0.4))));
                rationale = String.format(
                        "%s runs at similar levels before good and bad outcomes (avg %.1f vs %.1f) -- it is not strongly discriminating accounts. Suggest lowering its weight.",
                        factor.getLabel(), avgBad, avgGood);
            } else if (effectiveRelDiff > 0) {
                // Predictive alignment:
                double pct = Math.min(MAX_ADJUST_PCT, effectiveRelDiff);
                suggestedWeight = round2(Math.max(0.1, Math.min(5.0, currentWeight * (1 + pct))));
                if (direction < 0) {
                    rationale = String.format(
                            "%s is notably higher ahead of successful payments and kept promises (avg %.1f good vs %.1f bad) -- it is a strong positive credit signal. Suggest raising its relief weight.",
                            factor.getLabel(), avgGood, avgBad);
                } else {
                    rationale = String.format(
                            "%s runs notably higher ahead of defaults and broken commitments (avg %.1f bad vs %.1f good) -- it is predictive of risk. Suggest raising its weight.",
                            factor.getLabel(), avgBad, avgGood);
                }
            } else {
                // Counter-predictive:
                double pct = Math.min(MAX_ADJUST_PCT, -effectiveRelDiff);
                suggestedWeight = round2(Math.max(0.1, Math.min(5.0, currentWeight * (1 - pct))));
                if (direction < 0) {
                    rationale = String.format(
                            "%s is higher ahead of bad outcomes than good ones (avg %.1f bad vs %.1f good) -- this relief factor may be muting accounts that still defaulted. Suggest lowering its weight.",
                            factor.getLabel(), avgBad, avgGood);
                } else {
                    rationale = String.format(
                            "%s is actually higher ahead of good outcomes than bad ones (avg %.1f vs %.1f) -- current risk direction may be working against you. Suggest lowering its weight.",
                            factor.getLabel(), avgGood, avgBad);
                }
            }

            suggestions.add(new WeightSuggestion(factor.getId(), factor.getFactorKey(), factor.getLabel(),
                    currentWeight, suggestedWeight, rationale, good.size(), bad.size()));
        }

        return suggestions;
    }

    /** true = good outcome, false = bad outcome, null = not a classifiable outcome event type. */
    private Boolean classify(OutcomeEvent event, Map<Long, ReasonCode> reasonCodesById) {
        switch (event.getEventType()) {
            case "ptp_kept":
                return true;
            case "ptp_broken":
                return false;
            case "dispute_resolved":
                ReasonCode rc = event.getReasonCodeId() == null ? null : reasonCodesById.get(event.getReasonCodeId());
                return rc != null && "payment_processed".equals(rc.getCode());
            default:
                return null;
        }
    }

    private double average(List<Double> values) {
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
