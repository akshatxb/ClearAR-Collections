package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.CommunicationRequest;
import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Communication;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.AccountService;
import com.clearar.collections.collectionsapp.service.CommunicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/** P0.4 #13-15 -- communication history timeline, manual note logging, reminder sending. */
@RestController
@RequestMapping("/api/accounts/{accountId}")
@RequiredArgsConstructor
public class CommunicationController {

    private final CommunicationService communicationService;
    private final AccountService accountService;

    @GetMapping("/communications")
    public List<Communication> history(@PathVariable Long accountId) {
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(accountId, orgId, SecurityUtils.currentUser()); // enforces org & collector scoping
        return communicationService.history(accountId);
    }

    @PostMapping("/communications")
    public Communication log(@PathVariable Long accountId, @Valid @RequestBody CommunicationRequest req) {
        Long orgId = SecurityUtils.requireOrgId();
        accountService.getScopedForUser(accountId, orgId, SecurityUtils.currentUser());
        Long userId = SecurityUtils.currentUser().getUserId();
        return communicationService.log(accountId, req.getType(), req.getContent(), req.getDurationSeconds(), userId);
    }

    /** #15 -- template keyed by aging bucket; demo mode logs the reminder as a communication. */
    @PostMapping("/send-reminder")
    public Communication sendReminder(@PathVariable Long accountId) {
        Long orgId = SecurityUtils.requireOrgId();
        Account account = accountService.getScopedForUser(accountId, orgId, SecurityUtils.currentUser());
        if ("indirect".equalsIgnoreCase(account.getOwnershipMode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot send direct dunning reminders to an indirect account. Please request outreach through the relationship owner.");
        }
        if ("relationship_owner".equalsIgnoreCase(SecurityUtils.currentUser().getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Relationship owners cannot send direct reminders");
        }
        Long userId = SecurityUtils.currentUser().getUserId();
        String bucket = accountService.worstAgingBucketForAccount(accountId);
        return communicationService.sendReminder(account, bucket, userId);
    }
}
