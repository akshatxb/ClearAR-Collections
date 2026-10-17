package com.clearar.collections.collectionsapp.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SendEmailRequest {
    private Long accountId;

    @NotBlank(message = "Recipient email is required")
    private String toEmail;

    @NotBlank(message = "Subject is required")
    private String subject;

    @NotBlank(message = "Email content is required")
    private String bodyHtml;

    private Long attachInvoiceId;
}
