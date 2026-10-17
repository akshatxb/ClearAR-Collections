package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    List<Invoice> findByAccountId(Long accountId);
    List<Invoice> findByAccountIdIn(List<Long> accountIds);
}
