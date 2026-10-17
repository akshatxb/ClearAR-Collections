package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.Ptp;
import com.clearar.collections.collectionsapp.entity.PtpStatus;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.PtpRepository;
import com.clearar.collections.collectionsapp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PtpServiceTest {

    @Mock
    private PtpRepository ptpRepository;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private OutcomeEventService outcomeEventService;
    @Mock
    private ScoringService scoringService;
    @Mock
    private UserRepository userRepository;
    @Mock
    private EmailService emailService;
    @Mock
    private InvoiceRepository invoiceRepository;

    private PtpService ptpService;

    @BeforeEach
    void setUp() {
        ptpService = new PtpService(
                ptpRepository,
                outcomeEventService,
                accountRepository,
                scoringService,
                userRepository,
                emailService,
                invoiceRepository
        );
    }

    @Test
    void sweepOverdue_orgScoped_onlySweepsOrgAccounts() {
        Long orgId = 1L;
        Account acc1 = Account.builder().id(10L).orgId(orgId).build();
        when(accountRepository.findByOrgId(orgId)).thenReturn(List.of(acc1));

        Ptp overduePtp = Ptp.builder()
                .id(100L)
                .accountId(10L)
                .promisedAmount(new BigDecimal("200.00"))
                .promisedDate(LocalDate.now().minusDays(2))
                .status(PtpStatus.pending)
                .build();

        when(ptpRepository.findByAccountIdInAndStatusAndPromisedDateLessThanEqual(
                eq(List.of(10L)), eq(PtpStatus.pending), any(LocalDate.class)))
                .thenReturn(List.of(overduePtp));

        when(ptpRepository.findById(100L)).thenReturn(Optional.of(overduePtp));
        when(ptpRepository.save(any(Ptp.class))).thenAnswer(inv -> inv.getArgument(0));
        when(accountRepository.findById(10L)).thenReturn(Optional.of(acc1));

        List<Ptp> swept = ptpService.sweepOverdue(orgId);

        assertEquals(1, swept.size());
        assertEquals(PtpStatus.broken, overduePtp.getStatus());
        verify(outcomeEventService).recordEvent(10L, "ptp_broken", null, 100L);
    }

    @Test
    void sweepOverdue_emptyOrg_returnsEmptyListWithoutQueryingDb() {
        Long orgId = 99L;
        when(accountRepository.findByOrgId(orgId)).thenReturn(List.of());

        List<Ptp> swept = ptpService.sweepOverdue(orgId);
        assertTrue(swept.isEmpty());
        verify(ptpRepository, never()).findByAccountIdInAndStatusAndPromisedDateLessThanEqual(any(), any(), any());
    }

    @Test
    void dueSoon_emptyAccounts_returnsEmptyList() {
        List<Ptp> result = ptpService.dueSoon(List.of());
        assertTrue(result.isEmpty());
        verify(ptpRepository, never()).findByAccountIdInAndStatusAndPromisedDateBetween(any(), any(), any(), any());
    }

    @Test
    void updateStatus_resetToPending_doesNotRecordOutcomeEvent() {
        Long ptpId = 200L;
        Long orgId = 1L;
        Long accountId = 10L;

        Ptp ptp = Ptp.builder()
                .id(ptpId)
                .accountId(accountId)
                .status(PtpStatus.broken)
                .build();

        Account account = Account.builder().id(accountId).orgId(orgId).build();
        when(ptpRepository.findById(ptpId)).thenReturn(Optional.of(ptp));
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
        when(ptpRepository.save(any(Ptp.class))).thenAnswer(inv -> inv.getArgument(0));

        Ptp result = ptpService.updateStatus(ptpId, PtpStatus.pending, orgId);

        assertEquals(PtpStatus.pending, result.getStatus());
        verify(outcomeEventService, never()).recordEvent(any(), any(), any(), any());
    }

    @Test
    void create_withValidInvoice_linksInvoiceSuccessfully() {
        Long accountId = 10L;
        Long invoiceId = 55L;
        Account account = Account.builder().id(accountId).orgId(1L).build();
        Invoice invoice = Invoice.builder().id(invoiceId).accountId(accountId).amount(new BigDecimal("500.00")).build();

        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
        when(invoiceRepository.findById(invoiceId)).thenReturn(Optional.of(invoice));
        when(ptpRepository.save(any(Ptp.class))).thenAnswer(inv -> inv.getArgument(0));

        Ptp result = ptpService.create(accountId, new BigDecimal("500.00"), LocalDate.now().plusDays(3), 1L, invoiceId);

        assertEquals(invoiceId, result.getInvoiceId());
        assertEquals(new BigDecimal("500.00"), result.getPromisedAmount());
        assertEquals(PtpStatus.pending, result.getStatus());
    }

    @Test
    void create_withForeignInvoice_throwsBadRequest() {
        Long accountId = 10L;
        Long invoiceId = 55L;
        Account account = Account.builder().id(accountId).orgId(1L).build();
        Invoice foreignInvoice = Invoice.builder().id(invoiceId).accountId(999L).amount(new BigDecimal("500.00")).build();

        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
        when(invoiceRepository.findById(invoiceId)).thenReturn(Optional.of(foreignInvoice));

        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> {
            ptpService.create(accountId, new BigDecimal("500.00"), LocalDate.now().plusDays(3), 1L, invoiceId);
        });
    }

    @Test
    void updateStatus_collectorOnDirectAccount_allowsUpdate() {
        Long ptpId = 1L;
        Long accountId = 10L;
        Account account = Account.builder().id(accountId).orgId(1L).ownershipMode("direct").relationshipOwnerId(null).assignedCollectorId(20L).build();
        Ptp ptp = Ptp.builder().id(ptpId).accountId(accountId).status(PtpStatus.pending).build();

        when(ptpRepository.findById(ptpId)).thenReturn(Optional.of(ptp));
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
        when(ptpRepository.save(any(Ptp.class))).thenAnswer(inv -> inv.getArgument(0));

        Ptp updated = ptpService.updateStatus(ptpId, PtpStatus.kept, 1L, "collector", 20L);
        assertEquals(PtpStatus.kept, updated.getStatus());
    }

    @Test
    void updateStatus_collectorOnUnassignedDirectAccount_throwsForbidden() {
        Long ptpId = 1L;
        Long accountId = 10L;
        Account account = Account.builder().id(accountId).orgId(1L).ownershipMode("direct").relationshipOwnerId(null).assignedCollectorId(99L).build();
        Ptp ptp = Ptp.builder().id(ptpId).accountId(accountId).status(PtpStatus.pending).build();

        when(ptpRepository.findById(ptpId)).thenReturn(Optional.of(ptp));
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        assertThrows(ResponseStatusException.class, () ->
                ptpService.updateStatus(ptpId, PtpStatus.kept, 1L, "collector", 20L));
    }

    @Test
    void updateStatus_collectorOnRelationshipOwnerAccount_throwsForbidden() {
        Long ptpId = 1L;
        Long accountId = 10L;
        Account account = Account.builder().id(accountId).orgId(1L).ownershipMode("indirect").relationshipOwnerId(30L).build();
        Ptp ptp = Ptp.builder().id(ptpId).accountId(accountId).status(PtpStatus.pending).build();

        when(ptpRepository.findById(ptpId)).thenReturn(Optional.of(ptp));
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> {
            ptpService.updateStatus(ptpId, PtpStatus.kept, 1L, "collector", 20L);
        });
    }

    @Test
    void updateStatus_relationshipOwnerOnOwnAccount_allowsUpdate() {
        Long ptpId = 1L;
        Long accountId = 10L;
        Long ownerId = 30L;
        Account account = Account.builder().id(accountId).orgId(1L).ownershipMode("indirect").relationshipOwnerId(ownerId).build();
        Ptp ptp = Ptp.builder().id(ptpId).accountId(accountId).status(PtpStatus.pending).build();

        when(ptpRepository.findById(ptpId)).thenReturn(Optional.of(ptp));
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
        when(ptpRepository.save(any(Ptp.class))).thenAnswer(inv -> inv.getArgument(0));

        Ptp updated = ptpService.updateStatus(ptpId, PtpStatus.broken, 1L, "relationship_owner", ownerId);
        assertEquals(PtpStatus.broken, updated.getStatus());
    }

    @Test
    void updateStatus_relationshipOwnerOnOtherAccount_throwsForbidden() {
        Long ptpId = 1L;
        Long accountId = 10L;
        Account account = Account.builder().id(accountId).orgId(1L).ownershipMode("indirect").relationshipOwnerId(30L).build();
        Ptp ptp = Ptp.builder().id(ptpId).accountId(accountId).status(PtpStatus.pending).build();

        when(ptpRepository.findById(ptpId)).thenReturn(Optional.of(ptp));
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> {
            ptpService.updateStatus(ptpId, PtpStatus.broken, 1L, "relationship_owner", 99L);
        });
    }

    @Test
    void updateStatus_managerOnAnyAccount_allowsUpdate() {
        Long ptpId = 1L;
        Long accountId = 10L;
        Account account = Account.builder().id(accountId).orgId(1L).ownershipMode("indirect").relationshipOwnerId(30L).build();
        Ptp ptp = Ptp.builder().id(ptpId).accountId(accountId).status(PtpStatus.pending).build();

        when(ptpRepository.findById(ptpId)).thenReturn(Optional.of(ptp));
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
        when(ptpRepository.save(any(Ptp.class))).thenAnswer(inv -> inv.getArgument(0));

        Ptp updated = ptpService.updateStatus(ptpId, PtpStatus.kept, 1L, "manager", 5L);
        assertEquals(PtpStatus.kept, updated.getStatus());
    }
}
