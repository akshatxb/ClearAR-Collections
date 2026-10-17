package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * P0.2 #6 -- payment records. "On insert, trigger or app-level logic updates linked invoice status."
 * Also closes the collector loop: recording a payment recomputes the account's priority score
 * (P0.3 #10) and flips any matching pending PTP to kept (P0.4 #16), so the outcome is visible
 * immediately in the worklist/detail view without a separate step.
 */
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final PtpRepository ptpRepository;
    private final PtpService ptpService;
    private final AccountRepository accountRepository;
    private final ScoringService scoringService;
    private final EmailService emailService;

    public Payment record(Long invoiceId, BigDecimal amount, LocalDate paidDate, String method) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment amount must be greater than zero");
        }
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found"));

        if (invoice.getStatus() == InvoiceStatus.written_off) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot record payment on a written-off invoice");
        }
        if (invoice.getStatus() == InvoiceStatus.paid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice is already fully paid");
        }

        Payment payment = Payment.builder()
                .invoiceId(invoiceId)
                .amount(amount)
                .paidDate(paidDate == null ? LocalDate.now() : paidDate)
                .method(method)
                .build();
        payment = paymentRepository.save(payment);

        BigDecimal totalPaid = paymentRepository.findByInvoiceId(invoiceId).stream()
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalPaid.compareTo(invoice.getAmount()) >= 0) {
            invoice.setStatus(InvoiceStatus.paid);
            invoiceRepository.save(invoice);
        }

        Long accountId = invoice.getAccountId();

        // Consume payment amount against pending PTPs. Prioritize PTPs linked explicitly
        // to this invoice, then fall back to account-level PTPs (Bug #3 & FE-17).
        // Pending PTPs linked to other invoices are left intact.
        BigDecimal unallocated = amount;
        List<Ptp> allPending = ptpRepository.findByAccountId(accountId).stream()
                .filter(p -> p.getStatus() == PtpStatus.pending)
                .toList();

        List<Ptp> invoicePtps = allPending.stream()
                .filter(p -> Objects.equals(p.getInvoiceId(), invoiceId))
                .sorted(Comparator.comparing(Ptp::getPromisedDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        List<Ptp> accountPtps = allPending.stream()
                .filter(p -> p.getInvoiceId() == null)
                .sorted(Comparator.comparing(Ptp::getPromisedDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        List<Ptp> candidatePtps = new ArrayList<>(invoicePtps);
        candidatePtps.addAll(accountPtps);

        for (Ptp p : candidatePtps) {
            if (unallocated.compareTo(p.getPromisedAmount()) >= 0) {
                ptpService.markResult(p.getId(), true);
                unallocated = unallocated.subtract(p.getPromisedAmount());
            }
        }

        accountRepository.findById(accountId)
                .ifPresent(a -> scoringService.computeAccountScore(accountId, a.getOrgId()));

        // Dispatch payment receipt email asynchronously/safely
        try {
            emailService.sendPaymentReceipt(invoice, payment);
        } catch (Exception e) {
            // Logged inside emailService, non-blocking for transaction
        }

        return payment;
    }

    public List<Payment> forInvoice(Long invoiceId) {
        return paymentRepository.findByInvoiceId(invoiceId);
    }
}
