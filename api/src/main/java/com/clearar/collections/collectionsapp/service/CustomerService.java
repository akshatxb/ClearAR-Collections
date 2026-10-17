package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.InvoiceStatus;
import com.clearar.collections.collectionsapp.entity.Organization;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.OrganizationRepository;
import com.clearar.collections.collectionsapp.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** P0.8 -- customer-safe views: no internal notes/scores exposed. */
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final OrganizationRepository organizationRepository;
    private final InvoiceService invoiceService;

    public Map<String, Object> balance(Long accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        List<Invoice> invoices = invoiceRepository.findByAccountId(accountId);
        Map<Long, BigDecimal> remainingMap = invoiceService.getRemainingBalances(invoices);

        BigDecimal openBalance = BigDecimal.ZERO;
        BigDecimal overdueAmount = BigDecimal.ZERO;
        BigDecimal currentAmount = BigDecimal.ZERO;
        int overdueCount = 0;
        int openCount = 0;
        LocalDate today = LocalDate.now();

        for (Invoice inv : invoices) {
            BigDecimal remaining = remainingMap.getOrDefault(inv.getId(), inv.getAmount());
            if (inv.getStatus() != InvoiceStatus.paid && inv.getStatus() != InvoiceStatus.written_off && remaining.signum() > 0) {
                openCount++;
                openBalance = openBalance.add(remaining);
                if (inv.getDueDate() != null && inv.getDueDate().isBefore(today)) {
                    overdueCount++;
                    overdueAmount = overdueAmount.add(remaining);
                } else {
                    currentAmount = currentAmount.add(remaining);
                }
            }
        }

        String orgName = organizationRepository.findById(account.getOrgId())
                .map(Organization::getName)
                .orElse("Creditor Organization");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("accountName", account.getName());
        result.put("accountId", account.getId());
        result.put("orgName", orgName);
        result.put("openBalance", openBalance);
        result.put("overdueAmount", overdueAmount);
        result.put("currentAmount", currentAmount);
        result.put("overdueCount", overdueCount);
        result.put("openCount", openCount);
        result.put("creditTerms", account.getCreditTerms() != null ? account.getCreditTerms() : "Net 30");
        result.put("creditHold", account.isCreditHold());
        result.put("contactEmail", account.getContactEmail());
        result.put("contactPhone", account.getContactPhone());
        List<Long> invoiceIds = invoices.stream().map(Invoice::getId).toList();
        List<com.clearar.collections.collectionsapp.entity.Payment> allPayments = invoiceIds.isEmpty()
                ? List.of()
                : paymentRepository.findByInvoiceIdIn(invoiceIds);
        Map<Long, List<com.clearar.collections.collectionsapp.entity.Payment>> paymentsByInvoice = allPayments.stream()
                .collect(java.util.stream.Collectors.groupingBy(com.clearar.collections.collectionsapp.entity.Payment::getInvoiceId));

        result.put("invoices", invoices.stream().map(inv -> {
            BigDecimal remaining = remainingMap.getOrDefault(inv.getId(), inv.getAmount());
            BigDecimal totalPaid = inv.getAmount().subtract(remaining);
            boolean isPartiallyPaid = totalPaid.signum() > 0 && remaining.signum() > 0 && inv.getStatus() != InvoiceStatus.paid && inv.getStatus() != InvoiceStatus.written_off;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", inv.getId());
            m.put("amount", inv.getAmount());
            m.put("remainingAmount", remaining);
            m.put("remainingBalance", remaining);
            m.put("totalPaid", totalPaid.signum() < 0 ? BigDecimal.ZERO : totalPaid);
            m.put("isPartiallyPaid", isPartiallyPaid);
            m.put("dueDate", inv.getDueDate());
            m.put("issuedDate", inv.getIssuedDate());
            m.put("status", inv.getStatus());
            m.put("isOverdue", inv.getDueDate() != null && inv.getDueDate().isBefore(today)
                    && inv.getStatus() != InvoiceStatus.paid && inv.getStatus() != InvoiceStatus.written_off
                    && remaining.signum() > 0);
            m.put("payments", paymentsByInvoice.getOrDefault(inv.getId(), List.of()));
            return m;
        }).toList());
        return result;
    }

    /** P1 #42 -- payment history view: a straightforward join across this account's invoices. */
    public List<Map<String, Object>> paymentHistory(Long accountId) {
        List<Invoice> invoices = invoiceRepository.findByAccountId(accountId);
        if (invoices.isEmpty()) return List.of();
        List<Long> invoiceIds = invoices.stream().map(Invoice::getId).toList();
        List<com.clearar.collections.collectionsapp.entity.Payment> payments = paymentRepository.findByInvoiceIdIn(invoiceIds);

        List<Map<String, Object>> rows = new java.util.ArrayList<>();
        for (var payment : payments) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("paymentId", payment.getId());
            m.put("invoiceId", payment.getInvoiceId());
            m.put("amount", payment.getAmount());
            m.put("paidDate", payment.getPaidDate());
            m.put("method", payment.getMethod());
            rows.add(m);
        }
        rows.sort(java.util.Comparator.comparing(
                m -> (java.time.LocalDate) m.get("paidDate"),
                java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())
        ));
        return rows;
    }
}
