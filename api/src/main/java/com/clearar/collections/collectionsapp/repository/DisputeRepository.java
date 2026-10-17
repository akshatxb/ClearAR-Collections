package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.Dispute;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DisputeRepository extends JpaRepository<Dispute, Long> {
    List<Dispute> findByAccountId(Long accountId);
    List<Dispute> findByAccountIdInOrderByCreatedAtDesc(List<Long> accountIds);
}
