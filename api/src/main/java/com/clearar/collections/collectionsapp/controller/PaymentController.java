package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.PaymentRequest;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.InvoiceStatus;
import com.clearar.collections.collectionsapp.entity.Payment;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.AccountService;
import com.clearar.collections.collectionsapp.service.InvoiceService;
import com.clearar.collections.collectionsapp.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

/**
 * P0.2 #6 -- payment records. Recording a payment updates the linked invoice's status,
 * flips a matching pending PTP to kept, and recomputes the account's priority score --
 * this is the "act on account -> outcome -> see it reflected" step of the P0 loop.
 */
@RestController
@RequestMapping("/api/invoices/{invoiceId}/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final InvoiceRepository invoiceRepository;
    private final AccountService accountService;
    private final InvoiceService invoiceService;

    @PostMapping
    public Payment record(@PathVariable Long invoiceId, @Valid @RequestBody PaymentRequest req) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found"));
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(invoice.getAccountId(), orgId, SecurityUtils.currentUser()); // org + collector scoping

        if (invoice.getStatus() == InvoiceStatus.paid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice is already paid");
        }
        if (invoice.getStatus() == InvoiceStatus.written_off) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice has been written off");
        }

        BigDecimal remaining = invoiceService.getRemainingBalance(invoice);
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice has no remaining balance");
        }
        if (req.getAmount() == null || req.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment amount must be greater than zero");
        }
        if (req.getAmount().compareTo(remaining) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment amount cannot exceed remaining balance of " + remaining);
        }

        return paymentService.record(invoiceId, req.getAmount(), req.getPaidDate(), req.getMethod());
    }

    @GetMapping
    public List<Payment> list(@PathVariable Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found"));
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(invoice.getAccountId(), orgId, SecurityUtils.currentUser());
        return paymentService.forInvoice(invoiceId);
    }
}
