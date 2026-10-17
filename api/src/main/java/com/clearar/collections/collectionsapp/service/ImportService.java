package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.InvoiceStatus;
import com.clearar.collections.collectionsapp.entity.User;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * P1 #43 -- CSV import. Expected header row (case-insensitive), one row per invoice line
 * (accounts repeat across rows and are created on first sight, then reused):
 *   accountName, contactEmail, contactPhone, creditTerms, ownershipMode, relationshipOwnerId,
 *   invoiceAmount, invoiceDueDate, invoiceIssuedDate
 * Only accountName + ownershipMode are required to create an account; invoiceAmount +
 * invoiceDueDate are required to create an invoice line -- rows missing them just create/reuse
 * the account with no invoice. Bad rows are skipped and reported rather than failing the batch.
 */
@Service
@RequiredArgsConstructor
public class ImportService {

    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final UserRepository userRepository;
    private final ScoringService scoringService;

    public Map<String, Object> importCsv(MultipartFile file, Long orgId) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file is required");
        }

        int accountsCreated = 0;
        int accountsReused = 0;
        int invoicesCreated = 0;
        List<String> errors = new ArrayList<>();
        Map<String, Account> accountsByName = new LinkedHashMap<>();
        for (Account a : accountRepository.findByOrgId(orgId)) {
            if (a.getName() != null) {
                accountsByName.put(a.getName().toLowerCase(), a);
            }
        }
        java.util.Set<Long> accountsTouched = new java.util.HashSet<>();

        try (InputStreamReader reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder()
                     .setHeader().setSkipHeaderRecord(true).setIgnoreHeaderCase(true).setTrim(true)
                     .build().parse(reader)) {

            int rowNum = 1;
            for (CSVRecord record : parser) {
                rowNum++;
                try {
                    String name = get(record, "accountName");
                    if (name == null || name.isBlank()) {
                        errors.add("Row " + rowNum + ": accountName is required");
                        continue;
                    }

                    Account account = accountsByName.get(name.toLowerCase());

                    if (account == null) {
                        String ownershipMode = get(record, "ownershipMode");
                        if (ownershipMode == null
                                || !(ownershipMode.equalsIgnoreCase("direct") || ownershipMode.equalsIgnoreCase("indirect"))) {
                            errors.add("Row " + rowNum + ": ownershipMode must be 'direct' or 'indirect' for a new account");
                            continue;
                        }
                        String relOwnerStr = get(record, "relationshipOwnerId");
                        Long relOwnerId = (relOwnerStr == null || relOwnerStr.isBlank()) ? null : Long.valueOf(relOwnerStr);
                        if (ownershipMode.equalsIgnoreCase("indirect") && relOwnerId == null) {
                            errors.add("Row " + rowNum + ": relationshipOwnerId required for an indirect account");
                            continue;
                        }

                        String collectorStr = get(record, "assignedCollectorId");
                        Long collectorId = (collectorStr == null || collectorStr.isBlank()) ? null : Long.valueOf(collectorStr);
                        if (collectorId == null) {
                            String collectorEmail = get(record, "collectorEmail");
                            if (collectorEmail != null && !collectorEmail.isBlank()) {
                                collectorId = userRepository.findByEmail(collectorEmail.trim().toLowerCase())
                                        .filter(u -> orgId.equals(u.getOrgId()))
                                        .map(User::getId)
                                        .orElse(null);
                            }
                        }
                        if (collectorId != null) {
                            User cUser = userRepository.findById(collectorId).orElse(null);
                            if (cUser == null || !orgId.equals(cUser.getOrgId())) {
                                errors.add("Row " + rowNum + ": assigned collector not found in organization");
                                continue;
                            }
                            if (!cUser.isActive()) {
                                errors.add("Row " + rowNum + ": assigned collector user is deactivated");
                                continue;
                            }
                            if (cUser.getRole() != com.clearar.collections.collectionsapp.entity.Role.collector) {
                                errors.add("Row " + rowNum + ": assigned user must have collector role. Managers cannot be assigned to accounts.");
                                continue;
                            }
                        }

                        account = Account.builder()
                                .orgId(orgId)
                                .name(name)
                                .contactEmail(get(record, "contactEmail"))
                                .contactPhone(get(record, "contactPhone"))
                                .creditTerms(get(record, "creditTerms"))
                                .ownershipMode(ownershipMode.toLowerCase())
                                .relationshipOwnerId(ownershipMode.equalsIgnoreCase("indirect") ? relOwnerId : null)
                                .assignedCollectorId(collectorId)
                                .creditHold(false)
                                .build();
                        account = accountRepository.save(account);
                        accountsCreated++;
                    } else {
                        accountsReused++;
                    }
                    accountsByName.put(name.toLowerCase(), account);

                    String amountStr = get(record, "invoiceAmount");
                    String dueDateStr = get(record, "invoiceDueDate");
                    if (amountStr != null && !amountStr.isBlank() && dueDateStr != null && !dueDateStr.isBlank()) {
                        BigDecimal amount;
                        LocalDate dueDate;
                        try {
                            amount = new BigDecimal(amountStr);
                            dueDate = LocalDate.parse(dueDateStr);
                        } catch (Exception e) {
                            errors.add("Row " + rowNum + ": invoiceAmount must be numeric and invoiceDueDate must be YYYY-MM-DD");
                            continue;
                        }
                        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                            errors.add("Row " + rowNum + ": invoiceAmount must be greater than zero");
                            continue;
                        }
                        String issuedStr = get(record, "invoiceIssuedDate");
                        LocalDate issued = (issuedStr == null || issuedStr.isBlank()) ? LocalDate.now() : LocalDate.parse(issuedStr);

                        Invoice invoice = Invoice.builder()
                                .accountId(account.getId())
                                .amount(amount)
                                .dueDate(dueDate)
                                .issuedDate(issued)
                                .status(InvoiceStatus.open)
                                .build();
                        invoiceRepository.save(invoice);
                        invoicesCreated++;
                        accountsTouched.add(account.getId());
                    }
                } catch (Exception rowEx) {
                    errors.add("Row " + rowNum + ": " + rowEx.getMessage());
                }
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read CSV file: " + e.getMessage());
        }

        // Recompute priority scores for every account that received a new invoice.
        for (Long accountId : accountsTouched) {
            scoringService.computeAccountScore(accountId, orgId);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("accountsCreated", accountsCreated);
        result.put("accountsReused", accountsReused);
        result.put("invoicesCreated", invoicesCreated);
        result.put("errors", errors);
        return result;
    }

    private String get(CSVRecord record, String header) {
        try {
            return record.isMapped(header) ? record.get(header) : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
