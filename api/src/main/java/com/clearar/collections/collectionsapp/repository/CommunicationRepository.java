package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.Communication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommunicationRepository extends JpaRepository<Communication, Long> {
    List<Communication> findByAccountIdOrderByCreatedAtDesc(Long accountId);

    /** P1 #40 -- personal performance dashboard: everything this collector has logged. */
    List<Communication> findByCreatedBy(Long userId);
}
