package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.AccountScore;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountScoreRepository extends JpaRepository<AccountScore, Long> {
    Optional<AccountScore> findTopByAccountIdOrderByComputedAtDesc(Long accountId);
    List<AccountScore> findByAccountIdOrderByComputedAtAsc(Long accountId);
}
