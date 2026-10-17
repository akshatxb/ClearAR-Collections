package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.InvoiceCreateRequest;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.AccountService;
import com.clearar.collections.collectionsapp.service.InvoiceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** P0.2 #5 -- invoice records. */
@RestController
@RequestMapping("/api/accounts/{accountId}/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;
    private final AccountService accountService;
    private final InvoiceRepository invoiceRepository;

    @PostMapping
    public Invoice create(@PathVariable Long accountId, @Valid @RequestBody InvoiceCreateRequest req) {
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(accountId, orgId, SecurityUtils.currentUser()); // org + collector scoping
        return invoiceService.create(accountId, req.getAmount(), req.getDueDate(), req.getIssuedDate());
    }

    /** P1 #45 -- write-off, manager-only. Note: mounted separately since it's keyed off invoiceId, not accountId. */
    @PatchMapping("/{invoiceId}/write-off")
    public Invoice writeOff(@PathVariable Long accountId, @PathVariable Long invoiceId) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScoped(accountId, orgId);
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found"));
        if (!invoice.getAccountId().equals(accountId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice does not belong to specified account");
        }
        return invoiceService.writeOff(invoiceId, orgId);
    }
}
