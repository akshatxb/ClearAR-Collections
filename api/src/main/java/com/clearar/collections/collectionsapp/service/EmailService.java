package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.EmailMessageRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import jakarta.mail.internet.MimeMessage;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final EmailMessageRepository emailMessageRepository;
    private final OrganizationRepository organizationRepository;
    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoicePdfService invoicePdfService;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${mail.from:no-reply@cleararcollections.com}")
    private String defaultFrom;

    /**
     * Sends an email (stores to DB log + transmits via SMTP if host configured) and returns the record.
     */
    public EmailMessage sendEmail(Long orgId, Long accountId, String toEmail, String subject,
                                  String bodyHtml, String category, boolean hasAttachment,
                                  String attachmentName, Long createdBy) {
        if (toEmail == null || toEmail.isBlank()) {
            log.warn("Cannot send email: recipient address is empty.");
            return null;
        }

        String deliveryStatus = "SENT";

        // If SMTP host is configured and mailSender bean is available, perform real SMTP dispatch
        if (mailSender != null && mailHost != null && !mailHost.trim().isEmpty()) {
            try {
                MimeMessage mimeMessage = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, hasAttachment, "UTF-8");
                helper.setFrom(defaultFrom);
                helper.setTo(toEmail.trim());
                helper.setSubject(subject != null ? subject : "Notification from ClearAR Collections");
                helper.setText(bodyHtml != null ? bodyHtml : "", true);

                mailSender.send(mimeMessage);
                log.info("Successfully dispatched real SMTP email to <{}>", toEmail);
            } catch (Exception e) {
                log.error("Failed to send email via SMTP to <{}>: {}", toEmail, e.getMessage());
                deliveryStatus = "FAILED";
            }
        } else {
            log.info("Simulated SMTP dispatch to <{}> (No spring.mail.host specified - message recorded to outbox log)", toEmail);
        }

        EmailMessage message = EmailMessage.builder()
                .orgId(orgId)
                .accountId(accountId)
                .toEmail(toEmail.trim())
                .subject(subject != null ? subject : "Notification from ClearAR Collections")
                .bodyHtml(bodyHtml)
                .category(category != null ? category : "MANUAL")
                .status(deliveryStatus)
                .hasAttachment(hasAttachment)
                .attachmentName(attachmentName)
                .createdBy(createdBy)
                .build();

        message = emailMessageRepository.save(message);
        return message;
    }

    // =========================================================================
    // Professional B2B Email Engine & Design System
    // =========================================================================

    public record MetricRow(String label, String value, boolean isHighlight) {
        public MetricRow(String label, String value) {
            this(label, value, false);
        }
    }

    @lombok.Builder
    @lombok.Getter
    public static class B2bEmailParams {
        private String preheader;
        private String orgName;
        private String categoryBadge;
        private String categoryBadgeBg;
        private String categoryBadgeColor;
        private String accentColor;
        private String headline;
        private String greeting;
        private String leadParagraph;
        private String calloutLabel;
        private String calloutValue;
        private String calloutSubtext;
        private List<MetricRow> metrics;
        private String customContentHtml;
        private String secondaryParagraph;
        private String ctaLabel;
        private String ctaUrl;
        private String footerNote;
    }

    /**
     * Builds an executive B2B financial email layout conforming to enterprise AR standards
     * (high-contrast typography, clean card container, structured ledger metrics, responsive layout).
     */
    public String buildB2bEmailHtml(B2bEmailParams p) {
        String safeOrg = (p.getOrgName() != null && !p.getOrgName().isBlank())
                ? p.getOrgName()
                : "ClearAR Creditor Services";
        String accent = (p.getAccentColor() != null) ? p.getAccentColor() : "#0f766e";
        String badgeBg = (p.getCategoryBadgeBg() != null) ? p.getCategoryBadgeBg() : "#f0fdf4";
        String badgeColor = (p.getCategoryBadgeColor() != null) ? p.getCategoryBadgeColor() : "#166534";
        String badgeText = (p.getCategoryBadge() != null) ? p.getCategoryBadge() : "OFFICIAL NOTICE";

        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html>\n")
          .append("<html lang=\"en\">\n")
          .append("<head>\n")
          .append("  <meta charset=\"utf-8\"/>\n")
          .append("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/>\n")
          .append("  <title>").append(p.getHeadline() != null ? p.getHeadline() : safeOrg).append("</title>\n")
          .append("</head>\n")
          .append("<body style=\"margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;\">\n");

        if (p.getPreheader() != null && !p.getPreheader().isBlank()) {
            sb.append("  <div style=\"display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f1f5f9;\">\n")
              .append("    ").append(p.getPreheader()).append("\n")
              .append("  </div>\n");
        }

        sb.append("  <table role=\"presentation\" width=\"100%\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" style=\"table-layout: fixed;\">\n")
          .append("    <tr>\n")
          .append("      <td align=\"center\">\n")
          .append("        <table role=\"presentation\" width=\"100%\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width: 600px; background-color: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05); overflow: hidden; text-align: left;\">\n")
          
          // Accent line
          .append("          <tr>\n")
          .append("            <td style=\"height: 4px; background-color: ").append(accent).append(";\"></td>\n")
          .append("          </tr>\n")

          // Header
          .append("          <tr>\n")
          .append("            <td style=\"padding: 22px 30px 18px; border-bottom: 1px solid #f1f5f9;\">\n")
          .append("              <table role=\"presentation\" width=\"100%\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\">\n")
          .append("                <tr>\n")
          .append("                  <td valign=\"middle\">\n")
          .append("                    <div style=\"font-size: 15px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px;\">")
          .append(safeOrg)
          .append("</div>\n")
          .append("                    <div style=\"font-size: 11.5px; color: #64748b; font-weight: 500; margin-top: 2px;\">ClearAR Collections Platform &bull; Accounts Receivable</div>\n")
          .append("                  </td>\n")
          .append("                  <td valign=\"middle\" align=\"right\">\n")
          .append("                    <span style=\"display: inline-block; padding: 4px 10px; border-radius: 9999px; background-color: ").append(badgeBg).append("; color: ").append(badgeColor).append("; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;\">")
          .append(badgeText)
          .append("</span>\n")
          .append("                  </td>\n")
          .append("                </tr>\n")
          .append("              </table>\n")
          .append("            </td>\n")
          .append("          </tr>\n")

          // Content body
          .append("          <tr>\n")
          .append("            <td style=\"padding: 28px 30px 30px;\">\n");

        if (p.getHeadline() != null && !p.getHeadline().isBlank()) {
            sb.append("              <h1 style=\"margin: 0 0 16px; font-size: 19px; font-weight: 700; color: #0f172a; line-height: 1.35; letter-spacing: -0.3px;\">")
              .append(p.getHeadline())
              .append("</h1>\n");
        }

        sb.append("              <div style=\"font-size: 14.5px; line-height: 1.6; color: #334155; margin-bottom: 20px;\">\n");
        if (p.getGreeting() != null && !p.getGreeting().isBlank()) {
            sb.append("                <p style=\"margin: 0 0 10px; font-weight: 600; color: #0f172a;\">").append(p.getGreeting()).append("</p>\n");
        }
        if (p.getLeadParagraph() != null && !p.getLeadParagraph().isBlank()) {
            sb.append("                <p style=\"margin: 0;\">").append(p.getLeadParagraph()).append("</p>\n");
        }
        sb.append("              </div>\n");

        // Amount Hero Callout Box
        if (p.getCalloutValue() != null && !p.getCalloutValue().isBlank()) {
            sb.append("              <div style=\"background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ").append(accent).append("; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px;\">\n")
              .append("                <div style=\"font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700;\">")
              .append(p.getCalloutLabel() != null ? p.getCalloutLabel() : "Amount").append("</div>\n")
              .append("                <div style=\"font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 3px; font-variant-numeric: tabular-nums;\">")
              .append(p.getCalloutValue()).append("</div>\n");
            if (p.getCalloutSubtext() != null && !p.getCalloutSubtext().isBlank()) {
                sb.append("                <div style=\"font-size: 12px; color: #64748b; margin-top: 4px;\">")
                  .append(p.getCalloutSubtext()).append("</div>\n");
            }
            sb.append("              </div>\n");
        }

        // Custom HTML content
        if (p.getCustomContentHtml() != null && !p.getCustomContentHtml().isBlank()) {
            sb.append("              <div style=\"margin-bottom: 22px; line-height: 1.65; color: #334155; font-size: 14px;\">\n")
              .append(p.getCustomContentHtml())
              .append("              </div>\n");
        }

        // Metrics Table
        if (p.getMetrics() != null && !p.getMetrics().isEmpty()) {
            sb.append("              <div style=\"border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 22px; background-color: #ffffff;\">\n")
              .append("                <table role=\"presentation\" width=\"100%\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse: collapse; font-size: 13.5px;\">\n");
            for (int i = 0; i < p.getMetrics().size(); i++) {
                MetricRow m = p.getMetrics().get(i);
                String borderStyle = (i < p.getMetrics().size() - 1) ? "border-bottom: 1px solid #f1f5f9;" : "";
                String rowBg = (i % 2 == 1) ? "background-color: #fafbfd;" : "background-color: #ffffff;";
                sb.append("                  <tr style=\"").append(rowBg).append("\">\n")
                  .append("                    <td style=\"padding: 10px 16px; color: #64748b; font-weight: 500; ").append(borderStyle).append("\">")
                  .append(m.label()).append("</td>\n")
                  .append("                    <td style=\"padding: 10px 16px; color: ").append(m.isHighlight() ? accent : "#0f172a").append("; font-weight: ").append(m.isHighlight() ? "700" : "600").append("; text-align: right; ").append(borderStyle).append("\">")
                  .append(m.value()).append("</td>\n")
                  .append("                  </tr>\n");
            }
            sb.append("                </table>\n")
              .append("              </div>\n");
        }

        // Secondary Paragraph
        if (p.getSecondaryParagraph() != null && !p.getSecondaryParagraph().isBlank()) {
            sb.append("              <p style=\"color: #64748b; font-size: 13.5px; line-height: 1.55; margin: 0 0 20px;\">")
              .append(p.getSecondaryParagraph()).append("</p>\n");
        }

        // Action Button
        if (p.getCtaUrl() != null && p.getCtaLabel() != null) {
            sb.append("              <div style=\"text-align: center; margin: 26px 0 16px;\">\n")
              .append("                <a href=\"").append(p.getCtaUrl()).append("\" style=\"background-color: ").append(accent).append("; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 13.5px; display: inline-block; letter-spacing: 0.02em; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);\">\n")
              .append("                  ").append(p.getCtaLabel()).append("\n")
              .append("                </a>\n")
              .append("                <div style=\"margin-top: 10px; font-size: 11.5px; color: #94a3b8;\">\n")
              .append("                  Link not clickable? Open <a href=\"").append(p.getCtaUrl()).append("\" style=\"color: ").append(accent).append("; text-decoration: underline;\">").append(p.getCtaUrl()).append("</a>\n")
              .append("                </div>\n")
              .append("              </div>\n");
        }

        sb.append("            </td>\n")
          .append("          </tr>\n")

          // Enterprise Footer
          .append("          <tr>\n")
          .append("            <td style=\"padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; line-height: 1.55; color: #64748b;\">\n")
          .append("              <div style=\"font-weight: 700; color: #334155; margin-bottom: 3px;\">\n")
          .append("                ClearAR Collections Platform &bull; Accounts Receivable Operations\n")
          .append("              </div>\n")
          .append("              <div style=\"margin-bottom: 6px;\">\n")
          .append("                This is an official commercial notice issued regarding your accounts receivable relationship with <strong>").append(safeOrg).append("</strong>.\n")
          .append("              </div>\n")
          .append("              <div style=\"font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px;\">\n")
          .append("                Delivered securely &bull; Confidential &bull; ").append(p.getFooterNote() != null ? p.getFooterNote() : "For billing inquiries, please contact your relationship owner or credit department.")
          .append("\n              </div>\n")
          .append("            </td>\n")
          .append("          </tr>\n")

          .append("        </table>\n")
          .append("      </td>\n")
          .append("    </tr>\n")
          .append("  </table>\n")
          .append("</body>\n")
          .append("</html>");

        return sb.toString();
    }

    /**
     * Helper to wrap arbitrary/custom email messages (e.g. from manual compose) into the executive B2B template.
     */
    public String buildCustomB2bEmailHtml(String orgName, String accountName, String subject,
                                          String bodyHtml, boolean hasAttachment, String attachmentName) {
        String safeOrg = (orgName != null && !orgName.isBlank()) ? orgName : "ClearAR Creditor Services";
        String safeAccount = (accountName != null && !accountName.isBlank()) ? accountName : "Valued Customer";

        List<MetricRow> metrics = new ArrayList<>();
        metrics.add(new MetricRow("Recipient Account:", safeAccount));
        metrics.add(new MetricRow("Notice Date:", LocalDate.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy"))));
        if (hasAttachment && attachmentName != null) {
            metrics.add(new MetricRow("Attached File:", attachmentName, true));
        }

        return buildB2bEmailHtml(B2bEmailParams.builder()
                .preheader("Account communication from " + safeOrg + " regarding " + safeAccount)
                .orgName(safeOrg)
                .categoryBadge("ACCOUNT NOTICE")
                .categoryBadgeBg("#f0fdfa")
                .categoryBadgeColor("#0f766e")
                .accentColor("#0f766e")
                .headline(subject != null ? subject : "Communication Regarding Your Account")
                .greeting("Dear " + safeAccount + " Accounts Team,")
                .leadParagraph("Please review the following communication regarding your account with <strong>" + safeOrg + "</strong>:")
                .customContentHtml(bodyHtml)
                .metrics(metrics)
                .ctaLabel("Access Customer Portal →")
                .ctaUrl("http://localhost:5173/portal")
                .footerNote("Please reply to this email or access the customer portal for remittances and statement inquiries.")
                .build());
    }

    /**
     * Send Dunning Reminder Email with styled HTML & account status.
     */
    public EmailMessage sendDunningReminder(Account account, String agingBucket, Long createdBy) {
        String orgName = organizationRepository.findById(account.getOrgId())
                .map(Organization::getName)
                .orElse("ClearAR Creditor Services");

        String bucket = agingBucket == null ? "current" : agingBucket;
        String subject = switch (bucket) {
            case "current" -> "Upcoming Payment Reminder - " + account.getName();
            case "0-30" -> "Payment Due Notice - " + account.getName();
            case "31-60" -> "Past Due Alert: Action Required - " + account.getName();
            case "61-90" -> "Urgent: Overdue Balance Escalation - " + account.getName();
            default -> "Final Notice: Immediate Payment Required - " + account.getName();
        };

        String accentColor = switch (bucket) {
            case "current" -> "#0d9488"; // teal
            case "0-30" -> "#0284c7"; // blue
            case "31-60" -> "#d97706"; // amber
            case "61-90" -> "#ea580c"; // orange
            default -> "#dc2626"; // red
        };

        String badgeBg = switch (bucket) {
            case "current" -> "#f0fdfa";
            case "0-30" -> "#f0f9ff";
            case "31-60" -> "#fffbeb";
            case "61-90" -> "#fff7ed";
            default -> "#fef2f2";
        };

        String badgeColor = switch (bucket) {
            case "current" -> "#0f766e";
            case "0-30" -> "#0369a1";
            case "31-60" -> "#b45309";
            case "61-90" -> "#c2410c";
            default -> "#b91c1c";
        };

        String badgeLabel = switch (bucket) {
            case "current" -> "UPCOMING DUE";
            case "0-30" -> "DUE: 0–30 DAYS";
            case "31-60" -> "PAST DUE: 31–60 DAYS";
            case "61-90" -> "OVERDUE: 61–90 DAYS";
            default -> "FINAL NOTICE: 90+ DAYS";
        };

        List<MetricRow> metrics = List.of(
            new MetricRow("Account Name:", account.getName()),
            new MetricRow("Aging Category:", bucket.toUpperCase()),
            new MetricRow("Agreed Terms:", account.getCreditTerms() != null ? account.getCreditTerms() : "Net 30"),
            new MetricRow("Notice Date:", LocalDate.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy")))
        );

        String bodyHtml = buildB2bEmailHtml(B2bEmailParams.builder()
                .preheader("Payment notice from " + orgName + " regarding account " + account.getName())
                .orgName(orgName)
                .categoryBadge(badgeLabel)
                .categoryBadgeBg(badgeBg)
                .categoryBadgeColor(badgeColor)
                .accentColor(accentColor)
                .headline(subject)
                .greeting("Dear " + account.getName() + " Accounts Payable,")
                .leadParagraph("This is an official notice regarding your open billing account with <strong>" + orgName + "</strong>. Please review your outstanding ledger balances and arrange for remittance to maintain your account in good standing.")
                .metrics(metrics)
                .secondaryParagraph("You can inspect all itemized invoices, schedule payments, or file dispute inquiries directly through the ClearAR Customer Self-Service Portal.")
                .ctaLabel("Open Customer Portal & Settle →")
                .ctaUrl("http://localhost:5173/login")
                .footerNote("Remit payments according to your invoice payment instructions. For questions, contact your relationship owner.")
                .build());

        return sendEmail(account.getOrgId(), account.getId(), account.getContactEmail(),
                subject, bodyHtml, "REMINDER", false, null, createdBy);
    }

    /**
     * Send User/Team Invite Email with credentials and login link.
     */
    public EmailMessage sendUserInvite(Long orgId, String email, String name, String role, String tempPassword) {
        String orgName = orgId != null
                ? organizationRepository.findById(orgId).map(Organization::getName).orElse("ClearAR Organization")
                : "ClearAR Platform Administration";

        String subject = "You've been invited to join " + orgName + " on ClearAR";
        String recipientGreeting = name != null && !name.isBlank() ? "Hello " + name + "," : "Hello,";

        String credsHtml = """
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 20px;">
              <div style="margin-bottom: 12px;">
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Login Email</div>
                <div style="color: #0f172a; font-size: 14px; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin-top: 4px;">%s</div>
              </div>
              <div>
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Temporary Password</div>
                <div style="color: #0284c7; font-size: 17px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin-top: 4px; letter-spacing: 1.5px;">%s</div>
              </div>
            </div>
            """.formatted(email, tempPassword);

        List<MetricRow> metrics = List.of(
            new MetricRow("Organization:", orgName),
            new MetricRow("Assigned Role:", role.toUpperCase()),
            new MetricRow("Provisioned On:", LocalDate.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy")))
        );

        String bodyHtml = buildB2bEmailHtml(B2bEmailParams.builder()
                .preheader("You have been invited to join " + orgName + " on ClearAR")
                .orgName(orgName)
                .categoryBadge("WORKSPACE INVITATION")
                .categoryBadgeBg("#f0f9ff")
                .categoryBadgeColor("#0369a1")
                .accentColor("#0284c7")
                .headline("Welcome to ClearAR Collections Platform")
                .greeting(recipientGreeting)
                .leadParagraph("You have been granted access to <strong>" + orgName + "</strong> with the <strong>" + role + "</strong> role. Use your temporary credentials below to access the workspace:")
                .customContentHtml(credsHtml)
                .metrics(metrics)
                .secondaryParagraph("For your security, please update your temporary password immediately upon your initial login.")
                .ctaLabel("Sign in to ClearAR →")
                .ctaUrl("http://localhost:5173/login")
                .footerNote("If you did not anticipate this invitation, please notify your system administrator.")
                .build());

        return sendEmail(orgId, null, email, subject, bodyHtml, "INVITE", false, null, null);
    }

    /**
     * Send Payment Receipt / Confirmation Email.
     */
    public EmailMessage sendPaymentReceipt(Invoice invoice, Payment payment) {
        Account account = accountRepository.findById(invoice.getAccountId()).orElse(null);
        if (account == null || account.getContactEmail() == null) return null;

        String orgName = organizationRepository.findById(account.getOrgId())
                .map(Organization::getName)
                .orElse("ClearAR Creditor Services");

        String subject = "Payment Receipt: $" + payment.getAmount() + " for Invoice #" + invoice.getId();

        List<MetricRow> metrics = List.of(
            new MetricRow("Receipt Reference:", "PAY-" + payment.getId()),
            new MetricRow("Applied Invoice:", "#" + invoice.getId()),
            new MetricRow("Transaction Date:", payment.getPaidDate() != null ? payment.getPaidDate().toString() : LocalDate.now().toString()),
            new MetricRow("Payment Method:", payment.getMethod() != null ? payment.getMethod() : "Standard Transfer")
        );

        String bodyHtml = buildB2bEmailHtml(B2bEmailParams.builder()
                .preheader("Payment receipt of $" + payment.getAmount() + " for Invoice #" + invoice.getId() + " - " + orgName)
                .orgName(orgName)
                .categoryBadge("PAYMENT CONFIRMED")
                .categoryBadgeBg("#ecfdf5")
                .categoryBadgeColor("#047857")
                .accentColor("#10b981")
                .headline("Official Payment Receipt")
                .greeting("Dear " + account.getName() + " Accounts Payable,")
                .leadParagraph("We have successfully received and processed your payment. The remittance has been applied against your account ledger.")
                .calloutLabel("Amount Paid & Cleared")
                .calloutValue("$" + payment.getAmount().toPlainString())
                .calloutSubtext("Payment successfully credited to Invoice #" + invoice.getId())
                .metrics(metrics)
                .secondaryParagraph("Your updated account balance and remaining invoices are reflected immediately on the ClearAR Customer Portal.")
                .ctaLabel("View Account Statement →")
                .ctaUrl("http://localhost:5173/login")
                .footerNote("Thank you for your business. For ledger adjustments or questions, contact your accounts representative.")
                .build());

        return sendEmail(account.getOrgId(), account.getId(), account.getContactEmail(),
                subject, bodyHtml, "PAYMENT_RECEIPT", false, null, null);
    }

    /**
     * Send Internal SLA Escalation Alert Email to Staff / Manager.
     */
    public EmailMessage sendEscalationAlert(Long orgId, String toEmail, String recipientName, String accountName, String reason) {
        String subject = "[SLA Breach] Urgent Escalation: " + accountName;

        List<MetricRow> metrics = List.of(
            new MetricRow("Account:", accountName),
            new MetricRow("Escalation Reason:", reason, true),
            new MetricRow("Detected Date:", LocalDate.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy")))
        );

        String bodyHtml = buildB2bEmailHtml(B2bEmailParams.builder()
                .preheader("[SLA Breach] Portfolio escalation triggered for " + accountName)
                .orgName("ClearAR Portfolio Management")
                .categoryBadge("SLA ESCALATION")
                .categoryBadgeBg("#fef2f2")
                .categoryBadgeColor("#b91c1c")
                .accentColor("#dc2626")
                .headline("Collections SLA Breach Detected")
                .greeting("Hello " + (recipientName != null ? recipientName : "Team Member") + ",")
                .leadParagraph("An overdue or high-risk account in your assigned portfolio has exceeded SLA collection limits and triggered automatic escalation:")
                .calloutLabel("Trigger Status")
                .calloutValue("Escalation Action Required")
                .calloutSubtext("Automated outreach paused pending collector / manager intervention.")
                .metrics(metrics)
                .secondaryParagraph("Please review the account activity history, verify customer contact details, and execute the required remediation.")
                .ctaLabel("Open Worklist & Review Account →")
                .ctaUrl("http://localhost:5173/worklist")
                .footerNote("Internal staff notification • Generated by ClearAR Portfolio Monitoring Engine.")
                .build());

        return sendEmail(orgId, null, toEmail, subject, bodyHtml, "ESCALATION", false, null, null);
    }

    /**
     * Send Account Registration & Welcome Email upon creation.
     */
    public EmailMessage sendAccountWelcome(Account account) {
        if (account == null || account.getContactEmail() == null || account.getContactEmail().isBlank()) return null;

        String orgName = organizationRepository.findById(account.getOrgId())
                .map(Organization::getName)
                .orElse("ClearAR Creditor Services");

        String subject = "Welcome to " + orgName + " - Account " + account.getName() + " Registered";

        List<MetricRow> metrics = List.of(
            new MetricRow("Account ID:", "ACC-" + account.getId()),
            new MetricRow("Credit Terms:", account.getCreditTerms() != null ? account.getCreditTerms() : "Net 30"),
            new MetricRow("Registered Email:", account.getContactEmail())
        );

        String bodyHtml = buildB2bEmailHtml(B2bEmailParams.builder()
                .preheader("Account registration confirmed for " + account.getName() + " with " + orgName)
                .orgName(orgName)
                .categoryBadge("ACCOUNT ONBOARDING")
                .categoryBadgeBg("#f0fdfa")
                .categoryBadgeColor("#0f766e")
                .accentColor("#0d9488")
                .headline("Commercial Account Registration Confirmed")
                .greeting("Welcome " + account.getName() + ",")
                .leadParagraph("Your commercial billing account has been successfully configured with <strong>" + orgName + "</strong>. You now have access to our self-service customer portal to review statements, execute payments, and collaborate with your creditor team.")
                .metrics(metrics)
                .secondaryParagraph("Through the customer portal, you can access real-time invoice copies, initiate ACH/Card settlements, and lodge dispute inquiries.")
                .ctaLabel("Access Customer Portal →")
                .ctaUrl("http://localhost:5173/portal")
                .footerNote("For billing or credit onboarding questions, please contact your accounts team.")
                .build());

        return sendEmail(account.getOrgId(), account.getId(), account.getContactEmail(),
                subject, bodyHtml, "ONBOARDING", false, null, null);
    }

    /**
     * Send New Invoice Notice to Customer Account.
     */
    public EmailMessage sendInvoiceNotice(Invoice invoice, Account account) {
        if (account == null || account.getContactEmail() == null || account.getContactEmail().isBlank()) return null;

        String orgName = organizationRepository.findById(account.getOrgId())
                .map(Organization::getName)
                .orElse("ClearAR Creditor Services");

        String subject = "New Invoice #" + invoice.getId() + " ($" + (invoice.getAmount() != null ? invoice.getAmount() : "0.00") + ") from " + orgName;

        List<MetricRow> metrics = List.of(
            new MetricRow("Invoice Reference:", "#" + invoice.getId()),
            new MetricRow("Issued Date:", invoice.getIssuedDate() != null ? invoice.getIssuedDate().toString() : LocalDate.now().toString()),
            new MetricRow("Due Date:", invoice.getDueDate() != null ? invoice.getDueDate().toString() : "Upon Receipt", true),
            new MetricRow("Credit Terms:", account.getCreditTerms() != null ? account.getCreditTerms() : "Net 30")
        );

        String bodyHtml = buildB2bEmailHtml(B2bEmailParams.builder()
                .preheader("New invoice #" + invoice.getId() + " from " + orgName + " for $" + (invoice.getAmount() != null ? invoice.getAmount() : "0.00"))
                .orgName(orgName)
                .categoryBadge("INVOICE ISSUED")
                .categoryBadgeBg("#eff6ff")
                .categoryBadgeColor("#1d4ed8")
                .accentColor("#2563eb")
                .headline("New Commercial Invoice Issued")
                .greeting("Dear " + account.getName() + " Accounts Payable,")
                .leadParagraph("A new invoice has been posted to your account by <strong>" + orgName + "</strong>. Please find the statement breakdown below:")
                .calloutLabel("Total Amount Due")
                .calloutValue("$" + (invoice.getAmount() != null ? invoice.getAmount().toPlainString() : "0.00"))
                .calloutSubtext("Payment expected on or before " + (invoice.getDueDate() != null ? invoice.getDueDate().toString() : "due date"))
                .metrics(metrics)
                .secondaryParagraph("You can inspect line items, download PDF statements, or submit direct payments via the ClearAR Customer Portal.")
                .ctaLabel("View or Pay Invoice in Portal →")
                .ctaUrl("http://localhost:5173/portal")
                .footerNote("Please include invoice #" + invoice.getId() + " on all remittance advices.")
                .build());

        return sendEmail(account.getOrgId(), account.getId(), account.getContactEmail(),
                subject, bodyHtml, "INVOICE", false, null, null);
    }

    /**
     * Send Promise-to-Pay (PTP) Confirmation Email.
     */
    public EmailMessage sendPtpConfirmation(Account account, Ptp ptp) {
        if (account == null || account.getContactEmail() == null || account.getContactEmail().isBlank()) return null;

        String orgName = organizationRepository.findById(account.getOrgId())
                .map(Organization::getName)
                .orElse("ClearAR Creditor Services");

        String subject = "Payment Promise Confirmation: $" + (ptp.getPromisedAmount() != null ? ptp.getPromisedAmount() : "0.00")
                + " scheduled for " + (ptp.getPromisedDate() != null ? ptp.getPromisedDate() : "TBD");

        List<MetricRow> metrics = List.of(
            new MetricRow("Commitment Reference:", "PTP-" + ptp.getId()),
            new MetricRow("Scheduled Date:", ptp.getPromisedDate() != null ? ptp.getPromisedDate().toString() : "TBD", true),
            new MetricRow("Account:", account.getName())
        );

        String bodyHtml = buildB2bEmailHtml(B2bEmailParams.builder()
                .preheader("Payment commitment confirmed for $" + (ptp.getPromisedAmount() != null ? ptp.getPromisedAmount() : "0.00") + " - " + orgName)
                .orgName(orgName)
                .categoryBadge("PROMISE TO PAY CONFIRMED")
                .categoryBadgeBg("#f5f3ff")
                .categoryBadgeColor("#6d28d9")
                .accentColor("#7c3aed")
                .headline("Payment Commitment Recorded")
                .greeting("Dear " + account.getName() + " Accounts Payable,")
                .leadParagraph("Thank you for confirming your payment plan with <strong>" + orgName + "</strong>. We have officially recorded your promise-to-pay commitment:")
                .calloutLabel("Promised Remittance Amount")
                .calloutValue("$" + (ptp.getPromisedAmount() != null ? ptp.getPromisedAmount().toPlainString() : "0.00"))
                .calloutSubtext("Scheduled for remittance on " + (ptp.getPromisedDate() != null ? ptp.getPromisedDate().toString() : "scheduled date"))
                .metrics(metrics)
                .secondaryParagraph("Fulfilling this commitment on or prior to the agreed date ensures your credit facility remains uninterrupted and pauses further escalation.")
                .ctaLabel("Complete Settlement in Portal →")
                .ctaUrl("http://localhost:5173/portal")
                .footerNote("If your payment schedule changes, please contact your relationship owner immediately.")
                .build());

        return sendEmail(account.getOrgId(), account.getId(), account.getContactEmail(),
                subject, bodyHtml, "PTP", false, null, null);
    }

    /**
     * Send Dispute Opened / Case Acknowledgement Email.
     */
    public EmailMessage sendDisputeOpened(Account account, Dispute dispute) {
        if (account == null || account.getContactEmail() == null || account.getContactEmail().isBlank()) return null;

        String orgName = organizationRepository.findById(account.getOrgId())
                .map(Organization::getName)
                .orElse("ClearAR Creditor Services");

        String subject = "Dispute Case #" + dispute.getId() + " Acknowledged - " + orgName;

        List<MetricRow> metrics = List.of(
            new MetricRow("Dispute Reference:", "DISP-" + dispute.getId()),
            new MetricRow("Related Invoice:", dispute.getInvoiceId() != null ? "#" + dispute.getInvoiceId() : "General Account"),
            new MetricRow("Reason Stated:", dispute.getReason() != null ? dispute.getReason() : "Under Review", true),
            new MetricRow("Current Status:", "Investigation in Progress")
        );

        String bodyHtml = buildB2bEmailHtml(B2bEmailParams.builder()
                .preheader("Dispute case #" + dispute.getId() + " logged with " + orgName)
                .orgName(orgName)
                .categoryBadge("DISPUTE LOGGED")
                .categoryBadgeBg("#fffbeb")
                .categoryBadgeColor("#b45309")
                .accentColor("#d97706")
                .headline("Dispute Submission Acknowledged")
                .greeting("Dear " + account.getName() + " Accounts Payable,")
                .leadParagraph("We have received your dispute submission and an official investigation case has been opened with <strong>" + orgName + "</strong>'s billing review team:")
                .metrics(metrics)
                .secondaryParagraph("Collection outreach and automated dunning notices on this specific item are temporarily paused while our analysts review the documentation.")
                .ctaLabel("Track Case Status in Portal →")
                .ctaUrl("http://localhost:5173/portal")
                .footerNote("Our dispute resolution team will follow up directly if further documentation is required.")
                .build());

        return sendEmail(account.getOrgId(), account.getId(), account.getContactEmail(),
                subject, bodyHtml, "DISPUTE", false, null, null);
    }

    /**
     * Send Dispute Resolved Email.
     */
    public EmailMessage sendDisputeResolved(Account account, Dispute dispute, String reasonLabel) {
        if (account == null || account.getContactEmail() == null || account.getContactEmail().isBlank()) return null;

        String orgName = organizationRepository.findById(account.getOrgId())
                .map(Organization::getName)
                .orElse("ClearAR Creditor Services");

        String subject = "Dispute Case #" + dispute.getId() + " Resolved - " + orgName;

        List<MetricRow> metrics = List.of(
            new MetricRow("Dispute Reference:", "DISP-" + dispute.getId()),
            new MetricRow("Related Invoice:", dispute.getInvoiceId() != null ? "#" + dispute.getInvoiceId() : "General Account"),
            new MetricRow("Resolution Category:", reasonLabel != null ? reasonLabel : "Standard Settlement", true),
            new MetricRow("Resolution Date:", LocalDate.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy")))
        );

        String bodyHtml = buildB2bEmailHtml(B2bEmailParams.builder()
                .preheader("Dispute case #" + dispute.getId() + " has been resolved by " + orgName)
                .orgName(orgName)
                .categoryBadge("DISPUTE RESOLVED")
                .categoryBadgeBg("#ecfdf5")
                .categoryBadgeColor("#047857")
                .accentColor("#10b981")
                .headline("Dispute Review Concluded")
                .greeting("Dear " + account.getName() + " Accounts Payable,")
                .leadParagraph("Your dispute case has been formally reviewed and concluded by the collections team at <strong>" + orgName + "</strong>:")
                .metrics(metrics)
                .secondaryParagraph("Any corresponding ledger adjustments or credit notes have been posted. Please review your updated statement on the customer portal.")
                .ctaLabel("Open Customer Portal →")
                .ctaUrl("http://localhost:5173/portal")
                .footerNote("If you have questions regarding the resolution breakdown, please reach out to your relationship manager.")
                .build());

        return sendEmail(account.getOrgId(), account.getId(), account.getContactEmail(),
                subject, bodyHtml, "DISPUTE", false, null, null);
    }

    /**
     * Send Password Reset / Temporary Password Email.
     */
    public EmailMessage sendPasswordReset(User user, String tempPassword) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) return null;

        String orgName = user.getOrgId() != null
                ? organizationRepository.findById(user.getOrgId()).map(Organization::getName).orElse("ClearAR Organization")
                : "ClearAR Collections Platform";

        String subject = "Password Reset - Temporary Credentials for ClearAR";
        String recipientGreeting = user.getName() != null && !user.getName().isBlank() ? "Hello " + user.getName() + "," : "Hello,";

        String credsHtml = """
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 20px;">
              <div style="margin-bottom: 12px;">
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Login Email</div>
                <div style="color: #0f172a; font-size: 14px; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin-top: 4px;">%s</div>
              </div>
              <div>
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Temporary Password</div>
                <div style="color: #0284c7; font-size: 17px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin-top: 4px; letter-spacing: 1.5px;">%s</div>
              </div>
            </div>
            """.formatted(user.getEmail(), tempPassword);

        String bodyHtml = buildB2bEmailHtml(B2bEmailParams.builder()
                .preheader("Password reset credentials for " + user.getEmail() + " on ClearAR")
                .orgName(orgName)
                .categoryBadge("SECURITY CREDENTIALS")
                .categoryBadgeBg("#f0f9ff")
                .categoryBadgeColor("#0369a1")
                .accentColor("#0284c7")
                .headline("Password Reset Requested")
                .greeting(recipientGreeting)
                .leadParagraph("We received a request to reset your password for your <strong>" + orgName + "</strong> workspace account. Use the temporary credentials below to log in:")
                .customContentHtml(credsHtml)
                .secondaryParagraph("For your security, please update your temporary password immediately upon signing in.")
                .ctaLabel("Sign in & Update Password →")
                .ctaUrl("http://localhost:5173/login")
                .footerNote("If you did not initiate this request, please contact your system administrator immediately.")
                .build());

        return sendEmail(user.getOrgId(), user.getAccountId(), user.getEmail(), subject, bodyHtml, "AUTH", false, null, null);
    }

    public List<EmailMessage> getOrgEmails(Long orgId) {
        return emailMessageRepository.findByOrgIdOrderByCreatedAtDesc(orgId);
    }

    public List<EmailMessage> getAccountEmails(Long accountId) {
        return emailMessageRepository.findByAccountIdOrderByCreatedAtDesc(accountId);
    }

    /**
     * Returns only platform-provisioning emails (INVITE, AUTH, ONBOARDING) for the platform_admin
     * email center. Org-internal categories (REMINDER, DISPUTE, ESCALATION, etc.) are excluded
     * to preserve tenant privacy — mirroring the scoping of the platform activity log.
     */
    public List<EmailMessage> getAllEmails() {
        return emailMessageRepository.findByCategoryInOrderByCreatedAtDesc(
                List.of("INVITE", "AUTH", "ONBOARDING")
        );
    }

    public EmailMessage getEmailById(Long id, Long orgId) {
        return emailMessageRepository.findByIdAndOrgId(id, orgId).orElse(null);
    }
}
