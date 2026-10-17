package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.EscalationRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EscalationRuleRepository extends JpaRepository<EscalationRule, Long> {
    List<EscalationRule> findByOrgIdAndActiveTrue(Long orgId);
}
