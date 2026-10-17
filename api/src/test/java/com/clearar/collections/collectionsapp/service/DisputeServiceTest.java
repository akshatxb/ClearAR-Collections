package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DisputeServiceTest {

    @Mock
    private DisputeRepository disputeRepository;
    @Mock
    private OutcomeEventService outcomeEventService;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private ScoringService scoringService;
    @Mock
    private ReasonCodeRepository reasonCodeRepository;
    @Mock
    private InvoiceRepository invoiceRepository;
    @Mock
    private InvoiceService invoiceService;
    @Mock
    private EmailService emailService;

    private DisputeService disputeService;

    @BeforeEach
    void setUp() {
        disputeService = new DisputeService(
                disputeRepository,
                outcomeEventService,
                accountRepository,
                scoringService,
                reasonCodeRepository,
                invoiceRepository,
                invoiceService,
                emailService
        );
    }

    @Test
    void update_resolvedDispute_restoresInvoiceToOpen() {
        Long disputeId = 1L;
        Long orgId = 10L;
        Long accountId = 100L;
        Long invoiceId = 1000L;

        Account account = Account.builder().id(accountId).orgId(orgId).build();
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        Dispute dispute = Dispute.builder()
                .id(disputeId)
                .accountId(accountId)
                .invoiceId(invoiceId)
                .status(DisputeStatus.open)
                .build();

        when(disputeRepository.findById(disputeId)).thenReturn(Optional.of(dispute));
        when(disputeRepository.save(any(Dispute.class))).thenAnswer(inv -> inv.getArgument(0));
        when(disputeRepository.findByAccountId(accountId)).thenReturn(List.of(dispute));

        Invoice invoice = new Invoice();
        invoice.setId(invoiceId);
        invoice.setStatus(InvoiceStatus.disputed);
        invoice.setAmount(new BigDecimal("500.00"));

        when(invoiceRepository.findById(invoiceId)).thenReturn(Optional.of(invoice));
        when(invoiceService.getRemainingBalance(invoice)).thenReturn(new BigDecimal("500.00"));

        Dispute updated = disputeService.update(disputeId, "resolved", 5L, orgId);

        assertEquals(DisputeStatus.resolved, updated.getStatus());
        assertEquals(InvoiceStatus.open, invoice.getStatus());
        verify(invoiceRepository).save(invoice);
    }

    @Test
    void update_resolvedDispute_restoresInvoiceToPaidIfFullyPaid() {
        Long disputeId = 1L;
        Long orgId = 10L;
        Long accountId = 100L;
        Long invoiceId = 1000L;

        Account account = Account.builder().id(accountId).orgId(orgId).build();
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        Dispute dispute = Dispute.builder()
                .id(disputeId)
                .accountId(accountId)
                .invoiceId(invoiceId)
                .status(DisputeStatus.open)
                .build();

        when(disputeRepository.findById(disputeId)).thenReturn(Optional.of(dispute));
        when(disputeRepository.save(any(Dispute.class))).thenAnswer(inv -> inv.getArgument(0));
        when(disputeRepository.findByAccountId(accountId)).thenReturn(List.of(dispute));

        Invoice invoice = new Invoice();
        invoice.setId(invoiceId);
        invoice.setStatus(InvoiceStatus.disputed);
        invoice.setAmount(new BigDecimal("500.00"));

        when(invoiceRepository.findById(invoiceId)).thenReturn(Optional.of(invoice));
        when(invoiceService.getRemainingBalance(invoice)).thenReturn(BigDecimal.ZERO);

        Dispute updated = disputeService.update(disputeId, "resolved", 5L, orgId);

        assertEquals(DisputeStatus.resolved, updated.getStatus());
        assertEquals(InvoiceStatus.paid, invoice.getStatus());
        verify(invoiceRepository).save(invoice);
    }
}
