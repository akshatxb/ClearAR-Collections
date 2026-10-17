package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.Payment;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InvoicePdfService {

    private final InvoiceRepository invoiceRepository;
    private final AccountRepository accountRepository;
    private final PaymentRepository paymentRepository;

    public byte[] generateInvoicePdf(Long invoiceId, Long customerAccountId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found"));
        if (!invoice.getAccountId().equals(customerAccountId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invoice does not belong to this account");
        }
        Account account = accountRepository.findById(customerAccountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        List<Payment> payments = paymentRepository.findByInvoiceId(invoiceId);
        BigDecimal totalPaid = payments.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal balance = invoice.getAmount().subtract(totalPaid);

        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage();
            doc.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float margin = 60;
                float y = page.getMediaBox().getHeight() - margin;

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 18);
                cs.newLineAtOffset(margin, y);
                cs.showText("Invoice Statement");
                cs.endText();
                y -= 30;

                y = writeLine(cs, margin, y, "Account: " + account.getName());
                y = writeLine(cs, margin, y, "Invoice #: " + invoice.getId());
                y = writeLine(cs, margin, y, "Issued: " + invoice.getIssuedDate());
                y = writeLine(cs, margin, y, "Due: " + invoice.getDueDate());
                y = writeLine(cs, margin, y, "Status: " + invoice.getStatus());
                y = writeLine(cs, margin, y, "Invoice amount: $" + invoice.getAmount());
                y = writeLine(cs, margin, y, "Total paid: $" + totalPaid);
                y = writeLine(cs, margin, y, "Balance due: $" + balance);
                y -= 15;

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 12);
                cs.newLineAtOffset(margin, y);
                cs.showText("Payment history");
                cs.endText();
                y -= 20;

                if (payments.isEmpty()) {
                    y = writeLine(cs, margin, y, "No payments recorded yet.");
                } else {
                    for (Payment p : payments) {
                        y = writeLine(cs, margin, y,
                                p.getPaidDate() + "  -  $" + p.getAmount()
                                        + (p.getMethod() != null ? "  (" + p.getMethod() + ")" : ""));
                    }
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate PDF");
        }
    }

    private float writeLine(PDPageContentStream cs, float x, float y, String text) throws IOException {
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 11);
        cs.newLineAtOffset(x, y);
        cs.showText(text);
        cs.endText();
        return y - 16;
    }
}