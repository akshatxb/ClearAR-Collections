package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.DisputeRequest;
import com.clearar.collections.collectionsapp.dto.PayBatchRequest;
import com.clearar.collections.collectionsapp.dto.PayRequest;
import com.clearar.collections.collectionsapp.dto.PtpRequest;
import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Dispute;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.InvoiceStatus;
import com.clearar.collections.collectionsapp.entity.Ptp;
import com.clearar.collections.collectionsapp.entity.ReasonCode;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.ReasonCodeRepository;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.CustomerService;
import com.clearar.collections.collectionsapp.service.DisputeService;
import com.clearar.collections.collectionsapp.service.InvoicePdfService;
import com.clearar.collections.collectionsapp.service.InvoiceService;
import com.clearar.collections.collectionsapp.service.PaymentService;
import com.clearar.collections.collectionsapp.service.PtpService;
import com.clearar.collections.collectionsapp.service.StripePaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** P0.8 + Customer Portal Enhancements: scoped balance, PTP, disputes, demo payments. */
@RestController
@RequestMapping("/api/customer")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;
    private final DisputeService disputeService;
    private final StripePaymentService stripePaymentService;
    private final InvoicePdfService invoicePdfService;
    private final PtpService ptpService;
    private final PaymentService paymentService;
    private final InvoiceRepository invoiceRepository;
    private final ReasonCodeRepository reasonCodeRepository;
    private final InvoiceService invoiceService;
    private final AccountRepository accountRepository;

    @GetMapping("/balance")
    public Map<String, Object> balance() {
        Long accountId = SecurityUtils.requireCustomerAccountId();
        return customerService.balance(accountId);
    }

    /** P1 #41 -- pay-now: creates a Stripe test-mode PaymentIntent for the given invoice. */
    @PostMapping("/pay")
    public Map<String, Object> pay(@Valid @RequestBody PayRequest req) {
        Long accountId = SecurityUtils.requireCustomerAccountId();
        return stripePaymentService.createPaymentIntent(req.getInvoiceId(), accountId, req.getAmount());
    }

    /** Demo / Instant payment mode: records a successful payment (full or custom partial amount). */
    @PostMapping("/pay-demo")
    public Map<String, Object> payDemo(@Valid @RequestBody PayRequest req) {
        Long accountId = SecurityUtils.requireCustomerAccountId();
        Invoice invoice = invoiceRepository.findById(req.getInvoiceId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found"));
        if (!invoice.getAccountId().equals(accountId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invoice does not belong to your account");
        }
        if (invoice.getStatus() == InvoiceStatus.paid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice is already paid");
        }

        BigDecimal remainingBalance = invoiceService.getRemainingBalance(invoice);
        if (remainingBalance.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice has no remaining balance");
        }

        BigDecimal payAmount = remainingBalance;
        if (req.getAmount() != null && req.getAmount().compareTo(BigDecimal.ZERO) > 0) {
            if (req.getAmount().compareTo(remainingBalance) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment amount cannot exceed remaining balance of " + remainingBalance);
            }
            payAmount = req.getAmount();
        }

        paymentService.record(invoice.getId(), payAmount, LocalDate.now(), "demo_card");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", payAmount.compareTo(remainingBalance) >= 0 ? "paid" : "partially_paid");
        result.put("invoiceId", invoice.getId());
        result.put("amount", payAmount);
        result.put("remainingBalance", remainingBalance.subtract(payAmount));
        result.put("method", "demo_card");
        return result;
    }

    /** Batch payment: pays multiple selected invoices in a single call. */
    @PostMapping("/pay-batch")
    public Map<String, Object> payBatch(@Valid @RequestBody PayBatchRequest req) {
        Long accountId = SecurityUtils.requireCustomerAccountId();
        List<Long> invoiceIds = req.getInvoiceIds();
        BigDecimal totalPaid = BigDecimal.ZERO;
        int paidCount = 0;

        for (Long invoiceId : invoiceIds) {
            Invoice invoice = invoiceRepository.findById(invoiceId).orElse(null);
            if (invoice == null || !invoice.getAccountId().equals(accountId) || invoice.getStatus() == InvoiceStatus.paid) {
                continue;
            }
            BigDecimal rem = invoiceService.getRemainingBalance(invoice);
            if (rem.compareTo(BigDecimal.ZERO) > 0) {
                paymentService.record(invoice.getId(), rem, LocalDate.now(), "batch_direct");
                totalPaid = totalPaid.add(rem);
                paidCount++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "success");
        result.put("paidCount", paidCount);
        result.put("totalAmount", totalPaid);
        result.put("method", "batch_direct");
        return result;
    }

    /** P1 #42 -- payment history view (customer). */
    @GetMapping("/payments")
    public List<Map<String, Object>> payments() {
        Long accountId = SecurityUtils.requireCustomerAccountId();
        return customerService.paymentHistory(accountId);
    }

    /** P1 #49 -- downloadable invoice/statement PDF. */
    @GetMapping("/invoices/{invoiceId}/pdf")
    public ResponseEntity<byte[]> invoicePdf(@PathVariable Long invoiceId) {
        Long accountId = SecurityUtils.requireCustomerAccountId();
        byte[] pdf = invoicePdfService.generateInvoicePdf(invoiceId, accountId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"invoice-" + invoiceId + ".pdf\"")
                .body(pdf);
    }

    /** Self-service Promise-to-Pay (PTP) creation. */
    @PostMapping("/ptp")
    public Ptp submitPtp(@Valid @RequestBody PtpRequest req) {
        Long accountId = SecurityUtils.requireCustomerAccountId();
        Long userId = SecurityUtils.currentUser().getUserId();
        return ptpService.create(accountId, req.getPromisedAmount(), req.getPromisedDate(), userId, req.getInvoiceId());
    }

    /** List customer-initiated or account-level PTPs. */
    @GetMapping("/ptp")
    public List<Ptp> myPtps() {
        Long accountId = SecurityUtils.requireCustomerAccountId();
        return ptpService.forAccount(accountId);
    }

    /** Dispute reason codes for customer categorization. */
    @GetMapping("/reason-codes")
    public List<ReasonCode> reasonCodes() {
        Long accountId = SecurityUtils.requireCustomerAccountId();
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        return reasonCodeRepository.findByOrgIdIsNullOrOrgId(account.getOrgId());
    }

    @PostMapping("/disputes")
    public Dispute submitDispute(@Valid @RequestBody DisputeRequest req) {
        Long accountId = SecurityUtils.requireCustomerAccountId();
        Long userId = SecurityUtils.currentUser().getUserId();
        return disputeService.create(accountId, req.getReason(), userId, true, req.getInvoiceId(), req.getReasonCodeId());
    }

    /** P1 #50 -- read-only, customer-safe view of the same disputes table. */
    @GetMapping("/disputes")
    public List<Dispute> myDisputes() {
        Long accountId = SecurityUtils.requireCustomerAccountId();
        return disputeService.forAccount(accountId);
    }
}
