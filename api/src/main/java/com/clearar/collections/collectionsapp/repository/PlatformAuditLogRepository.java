package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.PlatformAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlatformAuditLogRepository extends JpaRepository<PlatformAuditLog, Long> {
    List<PlatformAuditLog> findByTargetOrgIdOrderByCreatedAtDesc(Long targetOrgId);
    List<PlatformAuditLog> findAllByOrderByCreatedAtDesc();
}
