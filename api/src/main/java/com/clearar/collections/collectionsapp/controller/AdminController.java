package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.entity.EscalationEvent;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.EscalationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * P1 #32 -- manual-trigger admin jobs. checkSlaBreaches() runs on-demand via this endpoint
 * instead of a real cron, so it can be fired live during a demo.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final EscalationService escalationService;

    @PostMapping("/run-escalation-check")
    public List<EscalationEvent> runEscalationCheck() {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        return escalationService.checkSlaBreaches(orgId);
    }
}
