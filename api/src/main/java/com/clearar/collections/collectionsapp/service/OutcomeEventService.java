package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.AccountScore;
import com.clearar.collections.collectionsapp.entity.OutcomeEvent;
import com.clearar.collections.collectionsapp.repository.AccountScoreRepository;
import com.clearar.collections.collectionsapp.repository.OutcomeEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * P0.5 -- Reason-Coded Outcome Memory. Captures a factor_snapshot (the score breakdown
 * at time of event) so a later feedback-loop job (P1 #28) can analyze which factors
 * actually predicted good/bad outcomes.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OutcomeEventService {

    private final OutcomeEventRepository outcomeEventRepository;
    private final AccountScoreRepository accountScoreRepository;

    public OutcomeEvent recordEvent(Long accountId, String eventType, Long reasonCodeId, Long sourceId) {
        try {
            String snapshot = accountScoreRepository.findTopByAccountIdOrderByComputedAtDesc(accountId)
                    .map(AccountScore::getBreakdownJson)
                    .orElse("[]");

            OutcomeEvent event = OutcomeEvent.builder()
                    .accountId(accountId)
                    .eventType(eventType)
                    .reasonCodeId(reasonCodeId)
                    .sourceId(sourceId)
                    .factorSnapshotJson(snapshot)
                    .build();

            return outcomeEventRepository.save(event);
        } catch (Exception e) {
            log.error("Failed to record outcome event for account {}: {}", accountId, e.getMessage(), e);
            return null;
        }
    }
}
