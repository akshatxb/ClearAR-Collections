package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.EmailMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmailMessageRepository extends JpaRepository<EmailMessage, Long> {
    List<EmailMessage> findByOrgIdOrderByCreatedAtDesc(Long orgId);
    List<EmailMessage> findByAccountIdOrderByCreatedAtDesc(Long accountId);
    Optional<EmailMessage> findByIdAndOrgId(Long id, Long orgId);
    List<EmailMessage> findAllByOrderByCreatedAtDesc();
    List<EmailMessage> findByCategoryInOrderByCreatedAtDesc(List<String> categories);
}
