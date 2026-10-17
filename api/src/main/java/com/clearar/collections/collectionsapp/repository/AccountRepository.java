package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AccountRepository extends JpaRepository<Account, Long> {
    List<Account> findByOrgId(Long orgId);
    List<Account> findByOrgIdAndRelationshipOwnerId(Long orgId, Long relationshipOwnerId);
}
