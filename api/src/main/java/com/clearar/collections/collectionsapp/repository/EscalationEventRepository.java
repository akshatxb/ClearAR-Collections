package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.EscalationEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface EscalationEventRepository extends JpaRepository<EscalationEvent, Long> {
    List<EscalationEvent> findByAccountIdIn(List<Long> accountIds);

    /** Used to avoid re-escalating the same account on every manual trigger within a cooldown window. */
    List<EscalationEvent> findByAccountIdAndCreatedAtAfter(Long accountId, Instant since);
}
