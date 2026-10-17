package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EscalationServiceTest {

    @Mock
    private EscalationRuleRepository escalationRuleRepository;
    @Mock
    private EscalationEventRepository escalationEventRepository;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private InvoiceRepository invoiceRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AccountService accountService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private EmailService emailService;

    private EscalationService escalationService;

    @BeforeEach
    void setUp() {
        escalationService = new EscalationService(
                escalationRuleRepository,
                escalationEventRepository,
                accountRepository,
                invoiceRepository,
                userRepository,
                accountService,
                notificationService,
                emailService
        );
    }

    @Test
    void checkSlaBreaches_selectsHighestSeverityRuleFirst() {
        Long orgId = 1L;
        Long accountId = 10L;

        // Two rules: rule 1 for "0-30", rule 2 for "90+"
        // Returned in order: "0-30" first, then "90+"
        EscalationRule rule030 = EscalationRule.builder()
                .id(1L)
                .orgId(orgId)
                .agingBucket("0-30")
                .escalateToRole(Role.collector)
                .active(true)
                .build();

        EscalationRule rule90Plus = EscalationRule.builder()
                .id(2L)
                .orgId(orgId)
                .agingBucket("90+")
                .escalateToRole(Role.manager)
                .active(true)
                .build();

        when(escalationRuleRepository.findByOrgIdAndActiveTrue(orgId)).thenReturn(List.of(rule030, rule90Plus));

        Account account = Account.builder().id(accountId).orgId(orgId).build();
        when(accountRepository.findByOrgId(orgId)).thenReturn(List.of(account));
        when(invoiceRepository.findByAccountId(accountId)).thenReturn(List.of());
        when(accountService.worstAgingBucket(any())).thenReturn("90+");
        when(escalationEventRepository.findByAccountIdAndCreatedAtAfter(eq(accountId), any())).thenReturn(List.of());

        User managerUser = User.builder().id(50L).role(Role.manager).build();
        when(userRepository.findByOrgIdAndRoleAndActiveTrue(orgId, Role.manager)).thenReturn(List.of(managerUser));
        when(escalationEventRepository.save(any(EscalationEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        List<EscalationEvent> events = escalationService.checkSlaBreaches(orgId);

        assertEquals(1, events.size());
        // Must escalate to manager (rule90Plus), NOT collector (rule030)
        assertEquals(50L, events.get(0).getToUser());
        assertTrue(events.get(0).getReason().contains("threshold 90+"));
    }
}
