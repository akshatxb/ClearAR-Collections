package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.InvoiceStatus;
import com.clearar.collections.collectionsapp.entity.Payment;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.PaymentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvoiceServiceTest {

    @Mock
    private InvoiceRepository invoiceRepository;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private ScoringService scoringService;
    @Mock
    private EmailService emailService;

    private InvoiceService invoiceService;

    @BeforeEach
    void setUp() {
        invoiceService = new InvoiceService(invoiceRepository, accountRepository, paymentRepository, scoringService, emailService);
    }

    @Test
    void getRemainingBalance_noPayments_returnsFullAmount() {
        Invoice invoice = new Invoice();
        invoice.setId(1L);
        invoice.setAmount(new BigDecimal("1000.00"));
        invoice.setStatus(InvoiceStatus.open);

        when(paymentRepository.findByInvoiceId(1L)).thenReturn(List.of());

        BigDecimal remaining = invoiceService.getRemainingBalance(invoice);
        assertEquals(new BigDecimal("1000.00"), remaining);
    }

    @Test
    void getRemainingBalance_withPartialPayments_returnsCorrectBalance() {
        Invoice invoice = new Invoice();
        invoice.setId(1L);
        invoice.setAmount(new BigDecimal("1000.00"));
        invoice.setStatus(InvoiceStatus.open);

        Payment p1 = new Payment();
        p1.setAmount(new BigDecimal("300.00"));
        Payment p2 = new Payment();
        p2.setAmount(new BigDecimal("250.00"));

        when(paymentRepository.findByInvoiceId(1L)).thenReturn(List.of(p1, p2));

        BigDecimal remaining = invoiceService.getRemainingBalance(invoice);
        assertEquals(new BigDecimal("450.00"), remaining);
    }

    @Test
    void calculateOpenBalance_accountsForPartialPayments() {
        Invoice inv1 = new Invoice();
        inv1.setId(1L);
        inv1.setAmount(new BigDecimal("1000.00"));
        inv1.setStatus(InvoiceStatus.open);

        Invoice inv2 = new Invoice();
        inv2.setId(2L);
        inv2.setAmount(new BigDecimal("500.00"));
        inv2.setStatus(InvoiceStatus.open);

        Invoice paidInv = new Invoice();
        paidInv.setId(3L);
        paidInv.setAmount(new BigDecimal("700.00"));
        paidInv.setStatus(InvoiceStatus.paid);

        Payment p1 = new Payment();
        p1.setInvoiceId(1L);
        p1.setAmount(new BigDecimal("400.00"));

        when(paymentRepository.findByInvoiceIdIn(List.of(1L, 2L))).thenReturn(List.of(p1));

        BigDecimal totalOpen = invoiceService.calculateOpenBalance(List.of(inv1, inv2, paidInv));
        // inv1 remaining: 1000 - 400 = 600
        // inv2 remaining: 500
        // paidInv ignored
        // total: 1100.00
        assertEquals(new BigDecimal("1100.00"), totalOpen);
    }

    @Test
    void getRemainingBalances_computesMapForAllInvoices() {
        Invoice inv1 = new Invoice();
        inv1.setId(1L);
        inv1.setAmount(new BigDecimal("1000.00"));

        Invoice inv2 = new Invoice();
        inv2.setId(2L);
        inv2.setAmount(new BigDecimal("500.00"));

        Payment p1 = new Payment();
        p1.setInvoiceId(1L);
        p1.setAmount(new BigDecimal("200.00"));

        when(paymentRepository.findByInvoiceIdIn(List.of(1L, 2L))).thenReturn(List.of(p1));

        Map<Long, BigDecimal> balances = invoiceService.getRemainingBalances(List.of(inv1, inv2));
        assertEquals(new BigDecimal("800.00"), balances.get(1L));
        assertEquals(new BigDecimal("500.00"), balances.get(2L));
    }
}
