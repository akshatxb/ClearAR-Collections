package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.OutcomeEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OutcomeEventRepository extends JpaRepository<OutcomeEvent, Long> {
    List<OutcomeEvent> findByAccountId(Long accountId);

    /** P1 #27/#28 -- pull every outcome event for all accounts in an org for analytics/feedback jobs. */
    List<OutcomeEvent> findByAccountIdIn(List<Long> accountIds);
}
