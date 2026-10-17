package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.SendEmailRequest;
import com.clearar.collections.collectionsapp.entity.EmailMessage;
import com.clearar.collections.collectionsapp.entity.Organization;
import com.clearar.collections.collectionsapp.repository.OrganizationRepository;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.AccountService;
import com.clearar.collections.collectionsapp.service.CommunicationService;
import com.clearar.collections.collectionsapp.service.EmailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/emails")
@RequiredArgsConstructor
public class EmailController {

    private final EmailService emailService;
    private final AccountService accountService;
    private final CommunicationService communicationService;
    private final OrganizationRepository organizationRepository;

    /**
     * Lists emails for the organization or optionally filtered by accountId.
     */
    @GetMapping
    public List<EmailMessage> listEmails(@RequestParam(required = false) Long accountId) {
        Long orgId = SecurityUtils.requireOrgId();
        com.clearar.collections.collectionsapp.security.AuthenticatedUser currentUser = SecurityUtils.currentUser();
        if (accountId != null) {
            accountService.getScopedForUser(accountId, orgId, currentUser);
            return emailService.getAccountEmails(accountId);
        }
        java.util.Set<Long> visible = accountService.visibleAccountIds(orgId, currentUser);
        List<EmailMessage> all = emailService.getOrgEmails(orgId);
        if (visible == null) {
            return all;
        }
        return all.stream().filter(m -> m.getAccountId() != null && visible.contains(m.getAccountId())).toList();
    }

    /**
     * Fetch a single email message detail including full HTML content.
     */
    @GetMapping("/{id}")
    public EmailMessage getEmail(@PathVariable Long id) {
        Long orgId = SecurityUtils.requireOrgId();
        EmailMessage msg = emailService.getEmailById(id, orgId);
        if (msg == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Email not found");
        }
        java.util.Set<Long> visible = accountService.visibleAccountIds(orgId, SecurityUtils.currentUser());
        if (visible != null && (msg.getAccountId() == null || !visible.contains(msg.getAccountId()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: collectors can only view emails for their assigned accounts.");
        }
        return msg;
    }

    /**
     * Send a custom email (e.g. from Account Detail or Email Center).
     */
    @PostMapping("/send")
    public EmailMessage sendCustomEmail(@Valid @RequestBody SendEmailRequest req) {
        Long orgId = SecurityUtils.requireOrgId();
        Long userId = SecurityUtils.currentUser().getUserId();
        String userRole = SecurityUtils.currentUser().getRole();

        boolean hasAttachment = false;
        String attachmentName = null;

        String orgName = organizationRepository.findById(orgId)
                .map(Organization::getName)
                .orElse("ClearAR Creditor Services");
        String accountName = "Valued Customer";

        if (req.getAccountId() != null) {
            com.clearar.collections.collectionsapp.entity.Account account = accountService.getScopedForUser(req.getAccountId(), orgId, SecurityUtils.currentUser());
            accountName = account.getName();
            boolean isIndirect = "indirect".equalsIgnoreCase(account.getOwnershipMode());

            if ("relationship_owner".equalsIgnoreCase(userRole)) {
                if (account.getRelationshipOwnerId() == null || !account.getRelationshipOwnerId().equals(userId)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "You are not the assigned relationship owner for this account.");
                }
            } else if (isIndirect && "collector".equalsIgnoreCase(userRole)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Collectors cannot send direct emails to indirect accounts. Please request outreach through the relationship owner.");
            }

            if (req.getAttachInvoiceId() != null) {
                hasAttachment = true;
                attachmentName = "invoice-" + req.getAttachInvoiceId() + ".pdf";
            }
        }

        String finalHtml = req.getBodyHtml();
        if (finalHtml != null && !finalHtml.contains("<!DOCTYPE html>")) {
            finalHtml = emailService.buildCustomB2bEmailHtml(
                    orgName,
                    accountName,
                    req.getSubject(),
                    finalHtml,
                    hasAttachment,
                    attachmentName
            );
        }

        EmailMessage sent = emailService.sendEmail(
                orgId,
                req.getAccountId(),
                req.getToEmail(),
                req.getSubject(),
                finalHtml,
                "MANUAL",
                hasAttachment,
                attachmentName,
                userId
        );

        // Also record in communications history if tied to an account
        if (req.getAccountId() != null) {
            String commNote = "Email sent to " + req.getToEmail() + " | Subject: " + req.getSubject();
            if (hasAttachment) {
                commNote += " (Attached: " + attachmentName + ")";
            }
            communicationService.log(req.getAccountId(), "email", commNote, null, userId);
        }

        return sent;
    }
}
