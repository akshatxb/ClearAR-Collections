package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.ReasonCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReasonCodeRepository extends JpaRepository<ReasonCode, Long> {
    List<ReasonCode> findByOrgIdIsNullOrOrgId(Long orgId);
    boolean existsByOrgIdAndCode(Long orgId, String code);
    boolean existsByOrgIdIsNullAndCode(String code);
}
