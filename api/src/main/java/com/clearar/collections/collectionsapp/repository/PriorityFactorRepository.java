package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.PriorityFactor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PriorityFactorRepository extends JpaRepository<PriorityFactor, Long> {
    List<PriorityFactor> findByOrgIdAndActiveTrue(Long orgId);
}
