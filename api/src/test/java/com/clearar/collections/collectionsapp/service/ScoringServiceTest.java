package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.dto.ScoreFactorItem;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ScoringServiceTest {

    @Mock
    private InvoiceRepository invoiceRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private PtpRepository ptpRepository;
    @Mock
    private DisputeRepository disputeRepository;
    @Mock
    private PriorityFactorRepository priorityFactorRepository;
    @Mock
    private AccountScoreRepository accountScoreRepository;

    private ScoringService scoringService;

    @BeforeEach
    void setUp() {
        scoringService = new ScoringService(
                invoiceRepository,
                paymentRepository,
                ptpRepository,
                disputeRepository,
                priorityFactorRepository,
                accountScoreRepository
        );
    }

    @Test
    void agingBucket_futureDueDate_returnsCurrent() {
        LocalDate futureDate = LocalDate.now().plusDays(15);
        assertEquals("current", ScoringService.agingBucket(futureDate));
    }

    @Test
    void agingBucket_nullDueDate_returnsCurrent() {
        assertEquals("current", ScoringService.agingBucket(null));
    }

    @Test
    void agingBucket_overdueDates_returnExpectedBuckets() {
        LocalDate today = LocalDate.now();
        assertEquals("0-30", ScoringService.agingBucket(today.minusDays(5)));
        assertEquals("0-30", ScoringService.agingBucket(today.minusDays(30)));
        assertEquals("31-60", ScoringService.agingBucket(today.minusDays(45)));
        assertEquals("61-90", ScoringService.agingBucket(today.minusDays(75)));
        assertEquals("90+", ScoringService.agingBucket(today.minusDays(120)));
    }

    @Test
    void computeWeightedDpd_avoidsSingleOutlierDominance() {
        LocalDate today = LocalDate.now();
        // $10 invoice 120 days overdue vs $100,000 invoice 10 days overdue
        Invoice smallStale = Invoice.builder()
                .id(1L)
                .amount(new BigDecimal("10.00"))
                .dueDate(today.minusDays(120))
                .status(InvoiceStatus.open)
                .build();
        Invoice largeRecent = Invoice.builder()
                .id(2L)
                .amount(new BigDecimal("100000.00"))
                .dueDate(today.minusDays(10))
                .status(InvoiceStatus.open)
                .build();

        when(paymentRepository.findByInvoiceIdIn(any())).thenReturn(List.of());

        double weightedDpd = scoringService.computeWeightedDpd(List.of(smallStale, largeRecent));

        // Weighted DPD should be very close to 10 days (~10.01), NOT 120 days!
        assertTrue(weightedDpd < 11.0, "Weighted DPD should not be dominated by the $10 stale invoice: " + weightedDpd);
        assertTrue(weightedDpd >= 10.0, "Weighted DPD should be at least 10 days: " + weightedDpd);
    }

    @Test
    void computeAccountScore_appliesActivePtpGraceAndKeptRatioRelief() {
        Long accountId = 1L;
        Long orgId = 10L;
        LocalDate today = LocalDate.now();

        Invoice inv = Invoice.builder()
                .id(1L)
                .amount(new BigDecimal("20000.00"))
                .dueDate(today.minusDays(45))
                .status(InvoiceStatus.open)
                .build();

        // Customer has 1 active PTP due tomorrow, plus 2 kept PTPs historically
        Ptp activePtp = Ptp.builder()
                .id(1L)
                .accountId(accountId)
                .promisedAmount(new BigDecimal("10000.00"))
                .promisedDate(today.plusDays(1))
                .status(PtpStatus.pending)
                .build();
        Ptp keptPtp1 = Ptp.builder().id(2L).accountId(accountId).status(PtpStatus.kept).build();
        Ptp keptPtp2 = Ptp.builder().id(3L).accountId(accountId).status(PtpStatus.kept).build();

        when(invoiceRepository.findByAccountId(accountId)).thenReturn(List.of(inv));
        when(ptpRepository.findByAccountId(accountId)).thenReturn(List.of(activePtp, keptPtp1, keptPtp2));
        when(disputeRepository.findByAccountId(accountId)).thenReturn(List.of());
        when(paymentRepository.findByInvoiceIdIn(any())).thenReturn(List.of());
        when(priorityFactorRepository.findByOrgIdAndActiveTrue(orgId)).thenReturn(List.of());
        when(priorityFactorRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(accountScoreRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        AccountScore score = scoringService.computeAccountScore(accountId, orgId);

        assertNotNull(score);
        assertTrue(score.getTotalScore() >= 0.0);

        List<ScoreFactorItem> breakdown = scoringService.parseBreakdown(score.getBreakdownJson());
        ScoreFactorItem graceItem = breakdown.stream()
                .filter(b -> "active_ptp_grace".equals(b.getFactor()))
                .findFirst().orElse(null);
        assertNotNull(graceItem);
        assertEquals(-1, graceItem.getDirection());
        assertTrue(graceItem.getContribution() < 0, "Active PTP grace must contribute negatively to reduce urgency");

        ScoreFactorItem keptRatioItem = breakdown.stream()
                .filter(b -> "ptp_kept_ratio".equals(b.getFactor()))
                .findFirst().orElse(null);
        assertNotNull(keptRatioItem);
        assertEquals(-1, keptRatioItem.getDirection());
        assertTrue(keptRatioItem.getContribution() < 0, "PTP Kept ratio must contribute negatively to reward reliability");
    }

    @Test
    void computeAccountScore_withAstronomicalInvoice_doesNotSwellScoreBeyondBounds() {
        Long accountId = 2L;
        Long orgId = 10L;

        // Trillion dollar invoice (1,000,000,000,000.00)
        Invoice trillionInvoice = Invoice.builder()
                .id(999L)
                .amount(new BigDecimal("1000000000000.00"))
                .dueDate(LocalDate.now().plusDays(30)) // Not overdue
                .status(InvoiceStatus.open)
                .build();

        when(invoiceRepository.findByAccountId(accountId)).thenReturn(List.of(trillionInvoice));
        when(ptpRepository.findByAccountId(accountId)).thenReturn(List.of());
        when(disputeRepository.findByAccountId(accountId)).thenReturn(List.of());
        when(paymentRepository.findByInvoiceIdIn(any())).thenReturn(List.of());
        when(priorityFactorRepository.findByOrgIdAndActiveTrue(orgId)).thenReturn(List.of());
        when(priorityFactorRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(accountScoreRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AccountScore score = scoringService.computeAccountScore(accountId, orgId);

        assertNotNull(score);
        // The score should be in a reasonable range (e.g. <= 25.0), NOT millions or billions!
        assertTrue(score.getTotalScore() <= 25.0, "Score should not swell beyond bounds, but was: " + score.getTotalScore());
        assertTrue(score.getTotalScore() > 0.0, "Score should reflect the high value");

        List<ScoreFactorItem> breakdown = scoringService.parseBreakdown(score.getBreakdownJson());
        ScoreFactorItem invoiceItem = breakdown.stream()
                .filter(b -> "invoice_value".equals(b.getFactor()))
                .findFirst().orElse(null);
        assertNotNull(invoiceItem);
        // Normalized value is capped at 10.0, weight is 1.5 => contribution is at most 15.0
        assertTrue(invoiceItem.getContribution() <= 15.0, "Invoice value contribution should be capped at 15.0, but was: " + invoiceItem.getContribution());
    }
}

