package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.File;
import java.io.FileInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImportServiceTest {

    @Mock
    private AccountRepository accountRepository;
    @Mock
    private InvoiceRepository invoiceRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ScoringService scoringService;

    private ImportService importService;

    @BeforeEach
    void setUp() {
        importService = new ImportService(accountRepository, invoiceRepository, userRepository, scoringService);
    }

    @Test
    void importCsv_with30RecordsSample_importsAllSuccessfullyWithZeroErrors() throws Exception {
        Long orgId = 1L;
        when(accountRepository.findByOrgId(orgId)).thenReturn(new ArrayList<>());

        AtomicLong idSeq = new AtomicLong(100L);
        when(accountRepository.save(any(Account.class))).thenAnswer(inv -> {
            Account a = inv.getArgument(0);
            if (a.getId() == null) a.setId(idSeq.incrementAndGet());
            return a;
        });
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

        File csvFile = new File("..\\sample_import_30_records.csv");
        if (!csvFile.exists()) {
            csvFile = new File("..\\..\\sample_import_30_records.csv");
        }
        if (!csvFile.exists()) {
            csvFile = new File("sample_import_30_records.csv");
        }
        assertTrue(csvFile.exists(), "Sample CSV file should exist");

        MockMultipartFile file;
        try (FileInputStream fis = new FileInputStream(csvFile)) {
            file = new MockMultipartFile("file", "sample_import_30_records.csv", "text/csv", fis);
        }

        Map<String, Object> result = importService.importCsv(file, orgId);

        List<?> errors = (List<?>) result.get("errors");
        assertTrue(errors.isEmpty(), "Errors should be empty, but had: " + errors);
        assertEquals(15, result.get("accountsCreated"));
        assertEquals(15, result.get("accountsReused"));
        assertEquals(30, result.get("invoicesCreated"));
    }
}
