package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByInvoiceId(Long invoiceId);

    /** P1 #40 -- batch lookup for DSO-days-reduced calc. */
    List<Payment> findByInvoiceIdIn(List<Long> invoiceIds);

    boolean existsByMethod(String method);
}
