package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private InvoiceRepository invoiceRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private PtpRepository ptpRepository;
    @Mock
    private PtpService ptpService;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private ScoringService scoringService;
    @Mock
    private EmailService emailService;

    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService(
                invoiceRepository,
                paymentRepository,
                ptpRepository,
                ptpService,
                accountRepository,
                scoringService,
                emailService
        );
    }

    @Test
    void recordPayment_onDisputedInvoice_marksPaidWhenFullyPaid() {
        Invoice invoice = new Invoice();
        invoice.setId(10L);
        invoice.setAccountId(1L);
        invoice.setAmount(new BigDecimal("500.00"));
        invoice.setStatus(InvoiceStatus.disputed);

        when(invoiceRepository.findById(10L)).thenReturn(Optional.of(invoice));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        Payment payment = new Payment();
        payment.setAmount(new BigDecimal("500.00"));
        when(paymentRepository.findByInvoiceId(10L)).thenReturn(List.of(payment));
        when(ptpRepository.findByAccountId(1L)).thenReturn(List.of());

        paymentService.record(10L, new BigDecimal("500.00"), LocalDate.now(), "check");

        assertEquals(InvoiceStatus.paid, invoice.getStatus());
        verify(invoiceRepository).save(invoice);
    }

    @Test
    void recordPayment_singlePayment_doesNotMarkMultiplePTPsAsKept() {
        Invoice invoice = new Invoice();
        invoice.setId(10L);
        invoice.setAccountId(1L);
        invoice.setAmount(new BigDecimal("1000.00"));
        invoice.setStatus(InvoiceStatus.open);

        when(invoiceRepository.findById(10L)).thenReturn(Optional.of(invoice));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
        Payment payment = new Payment();
        payment.setAmount(new BigDecimal("300.00"));
        when(paymentRepository.findByInvoiceId(10L)).thenReturn(List.of(payment));

        Ptp ptp1 = Ptp.builder()
                .id(101L)
                .accountId(1L)
                .promisedAmount(new BigDecimal("300.00"))
                .promisedDate(LocalDate.now().plusDays(1))
                .status(PtpStatus.pending)
                .build();

        Ptp ptp2 = Ptp.builder()
                .id(102L)
                .accountId(1L)
                .promisedAmount(new BigDecimal("300.00"))
                .promisedDate(LocalDate.now().plusDays(5))
                .status(PtpStatus.pending)
                .build();

        when(ptpRepository.findByAccountId(1L)).thenReturn(List.of(ptp1, ptp2));

        // Payment of $300 should only satisfy ptp1 ($300), NOT ptp2
        paymentService.record(10L, new BigDecimal("300.00"), LocalDate.now(), "check");

        verify(ptpService, times(1)).markResult(101L, true);
        verify(ptpService, never()).markResult(102L, true);
    }

    @Test
    void recordPayment_sufficientPayment_marksMultiplePTPsAsKept() {
        Invoice invoice = new Invoice();
        invoice.setId(10L);
        invoice.setAccountId(1L);
        invoice.setAmount(new BigDecimal("1000.00"));
        invoice.setStatus(InvoiceStatus.open);

        when(invoiceRepository.findById(10L)).thenReturn(Optional.of(invoice));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        Payment payment = new Payment();
        payment.setAmount(new BigDecimal("600.00"));
        when(paymentRepository.findByInvoiceId(10L)).thenReturn(List.of(payment));

        Ptp ptp1 = Ptp.builder()
                .id(101L)
                .accountId(1L)
                .promisedAmount(new BigDecimal("300.00"))
                .promisedDate(LocalDate.now().plusDays(1))
                .status(PtpStatus.pending)
                .build();

        Ptp ptp2 = Ptp.builder()
                .id(102L)
                .accountId(1L)
                .promisedAmount(new BigDecimal("300.00"))
                .promisedDate(LocalDate.now().plusDays(5))
                .status(PtpStatus.pending)
                .build();

        when(ptpRepository.findByAccountId(1L)).thenReturn(List.of(ptp1, ptp2));

        // Payment of $600 should satisfy both ptp1 ($300) and ptp2 ($300)
        paymentService.record(10L, new BigDecimal("600.00"), LocalDate.now(), "check");

        verify(ptpService, times(1)).markResult(101L, true);
        verify(ptpService, times(1)).markResult(102L, true);
    }

    @Test
    void recordPayment_prioritizesInvoiceSpecificPtpAndIgnoresOtherInvoice() {
        Invoice invoice = new Invoice();
        invoice.setId(10L);
        invoice.setAccountId(1L);
        invoice.setAmount(new BigDecimal("1000.00"));
        invoice.setStatus(InvoiceStatus.open);

        when(invoiceRepository.findById(10L)).thenReturn(Optional.of(invoice));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        Payment payment = new Payment();
        payment.setAmount(new BigDecimal("300.00"));
        when(paymentRepository.findByInvoiceId(10L)).thenReturn(List.of(payment));

        // ptp1 is linked to invoice 99 (a different invoice) but earlier date
        Ptp ptpOtherInvoice = Ptp.builder()
                .id(101L)
                .accountId(1L)
                .invoiceId(99L)
                .promisedAmount(new BigDecimal("300.00"))
                .promisedDate(LocalDate.now().plusDays(1))
                .status(PtpStatus.pending)
                .build();

        // ptp2 is linked to invoice 10 (this invoice) with later date
        Ptp ptpThisInvoice = Ptp.builder()
                .id(102L)
                .accountId(1L)
                .invoiceId(10L)
                .promisedAmount(new BigDecimal("300.00"))
                .promisedDate(LocalDate.now().plusDays(5))
                .status(PtpStatus.pending)
                .build();

        // ptp3 is an account-level PTP
        Ptp ptpAccount = Ptp.builder()
                .id(103L)
                .accountId(1L)
                .invoiceId(null)
                .promisedAmount(new BigDecimal("300.00"))
                .promisedDate(LocalDate.now().plusDays(2))
                .status(PtpStatus.pending)
                .build();

        when(ptpRepository.findByAccountId(1L)).thenReturn(List.of(ptpOtherInvoice, ptpThisInvoice, ptpAccount));

        // Payment of $300 on invoice 10 should ONLY satisfy ptp2 (linked to invoice 10),
        // NOT ptp1 (linked to invoice 99) or ptp3 (account level)
        paymentService.record(10L, new BigDecimal("300.00"), LocalDate.now(), "check");

        verify(ptpService, times(1)).markResult(102L, true);
        verify(ptpService, never()).markResult(101L, true);
        verify(ptpService, never()).markResult(103L, true);
    }
}
