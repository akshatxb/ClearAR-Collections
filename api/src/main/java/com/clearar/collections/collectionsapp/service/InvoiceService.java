package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.InvoiceStatus;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.entity.Payment;
import com.clearar.collections.collectionsapp.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/** P0.2 #5 -- invoice records. */
@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final AccountRepository accountRepository;
    private final PaymentRepository paymentRepository;
    private final ScoringService scoringService;
    private final EmailService emailService;

    public Invoice create(Long accountId, BigDecimal amount, LocalDate dueDate, LocalDate issuedDate) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice amount must be greater than zero");
        }
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));

        Invoice invoice = Invoice.builder()
                .accountId(accountId)
                .amount(amount)
                .dueDate(dueDate)
                .status(InvoiceStatus.open)
                .issuedDate(issuedDate == null ? LocalDate.now() : issuedDate)
                .build();
        invoice = invoiceRepository.save(invoice);

        // P0.3 #10 -- new invoice changes overdue-days / invoice-value factors, recompute now.
        scoringService.computeAccountScore(accountId, account.getOrgId());

        // Send New Invoice Email Notification
        try {
            emailService.sendInvoiceNotice(invoice, account);
        } catch (Exception e) {
            // Non-blocking for invoice creation transaction
        }

        return invoice;
    }

    /** P1 #45 -- write-off: manager-only, removes the invoice from open balance/aging without a payment. */
    public Invoice writeOff(Long invoiceId, Long orgId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found"));
        Account account = accountRepository.findById(invoice.getAccountId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        if (!account.getOrgId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invoice not in your organization");
        }
        if (invoice.getStatus() == InvoiceStatus.paid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot write off an already paid invoice");
        }
        if (invoice.getStatus() == InvoiceStatus.written_off) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice is already written off");
        }
        invoice.setStatus(InvoiceStatus.written_off);
        invoice = invoiceRepository.save(invoice);
        scoringService.computeAccountScore(account.getId(), orgId);
        return invoice;
    }

    /** Computes remaining balance for an invoice by deducting all recorded payments. */
    public BigDecimal getRemainingBalance(Invoice invoice) {
        if (invoice == null || invoice.getStatus() == InvoiceStatus.paid || invoice.getStatus() == InvoiceStatus.written_off) {
            return BigDecimal.ZERO;
        }
        List<Payment> payments = paymentRepository.findByInvoiceId(invoice.getId());
        BigDecimal totalPaid = payments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal remaining = invoice.getAmount().subtract(totalPaid);
        return remaining.signum() < 0 ? BigDecimal.ZERO : remaining;
    }

    public BigDecimal getRemainingBalance(Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found"));
        return getRemainingBalance(invoice);
    }

    /**
     * Batch-efficient calculation returning a map of invoiceId -> remainingBalance.
     * Uses a single query to fetch all payments for the invoices.
     */
    public Map<Long, BigDecimal> getRemainingBalances(List<Invoice> invoices) {
        if (invoices == null || invoices.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<Long, BigDecimal> result = new LinkedHashMap<>();
        List<Invoice> openInvoices = new ArrayList<>();

        for (Invoice inv : invoices) {
            if (inv.getStatus() == InvoiceStatus.paid || inv.getStatus() == InvoiceStatus.written_off) {
                result.put(inv.getId(), BigDecimal.ZERO);
            } else {
                openInvoices.add(inv);
            }
        }

        if (openInvoices.isEmpty()) {
            return result;
        }

        List<Long> openIds = openInvoices.stream().map(Invoice::getId).toList();
        List<Payment> payments = paymentRepository.findByInvoiceIdIn(openIds);

        Map<Long, BigDecimal> paidByInvoice = new HashMap<>();
        for (Payment p : payments) {
            paidByInvoice.merge(p.getInvoiceId(), p.getAmount(), BigDecimal::add);
        }

        for (Invoice inv : openInvoices) {
            BigDecimal totalPaid = paidByInvoice.getOrDefault(inv.getId(), BigDecimal.ZERO);
            BigDecimal remaining = inv.getAmount().subtract(totalPaid);
            result.put(inv.getId(), remaining.signum() < 0 ? BigDecimal.ZERO : remaining);
        }

        return result;
    }

    /**
     * Calculates the true open balance across a list of invoices, accounting for all partial payments.
     */
    public BigDecimal calculateOpenBalance(List<Invoice> invoices) {
        Map<Long, BigDecimal> balances = getRemainingBalances(invoices);
        return balances.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}

