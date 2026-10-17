package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.PriorityFactorUpdateRequest;
import com.clearar.collections.collectionsapp.dto.WeightSuggestion;
import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.EscalationService;
import com.clearar.collections.collectionsapp.service.OrgService;
import com.clearar.collections.collectionsapp.service.UserStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/** P0.7 -- team-wide dashboard + priority factor configuration (the live-demo "reorder the worklist" moment). */
@RestController
@RequestMapping("/api/orgs/{orgId}")
@RequiredArgsConstructor
public class OrgController {

    private final OrgService orgService;
    private final EscalationService escalationService;
    private final UserStatsService userStatsService;

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@PathVariable Long orgId) {
        requireSameOrg(orgId);
        SecurityUtils.requireRole("manager");
        return orgService.dashboard(orgId);
    }

    /** Manager-only: team performance & productivity metrics across all staff in the org. */
    @GetMapping("/team-stats")
    public List<Map<String, Object>> teamStats(@PathVariable Long orgId) {
        requireSameOrg(orgId);
        SecurityUtils.requireRole("manager");
        return userStatsService.teamStats(orgId);
    }

    @GetMapping("/priority-factors")
    public List<PriorityFactor> getFactors(@PathVariable Long orgId) {
        requireSameOrg(orgId);
        return orgService.getFactors(orgId);
    }

    /** Manager-only: change a factor's weight, e.g. via a slider -- worklist reorders on next fetch. */
    @PatchMapping("/priority-factors")
    public List<PriorityFactor> updateFactors(@PathVariable Long orgId, @RequestBody PriorityFactorUpdateRequest req) {
        requireSameOrg(orgId);
        SecurityUtils.requireRole("manager");
        return orgService.updateFactors(orgId, req.getFactors());
    }

    /** P1 #27 -- outcome analytics dashboard: outcome_events grouped by reason code / event type. */
    @GetMapping("/outcome-stats")
    public Map<String, Object> outcomeStats(@PathVariable Long orgId) {
        requireSameOrg(orgId);
        SecurityUtils.requireRole("manager");
        return orgService.outcomeStats(orgId);
    }

    /** P1 #28 -- run on-demand (button, not a cron): suggest weight changes from outcome history. */
    @GetMapping("/weight-suggestions")
    public List<WeightSuggestion> weightSuggestions(@PathVariable Long orgId) {
        requireSameOrg(orgId);
        SecurityUtils.requireRole("manager");
        return orgService.weightSuggestions(orgId);
    }

    /** P1 #32 -- current SLA escalation rules (seeded with sensible defaults on first read). */
    @GetMapping("/escalation-rules")
    public List<EscalationRule> escalationRules(@PathVariable Long orgId) {
        requireSameOrg(orgId);
        return orgService.escalationRules(orgId);
    }

    /** Manager-only: create a new SLA escalation rule. */
    @PostMapping("/escalation-rules")
    public EscalationRule createEscalationRule(
            @PathVariable Long orgId,
            @RequestBody Map<String, String> body) {
        requireSameOrg(orgId);
        SecurityUtils.requireRole("manager");
        String bucket = body.get("agingBucket");
        String roleStr = body.get("escalateToRole");
        Role role = roleStr != null ? Role.valueOf(roleStr) : Role.manager;
        return escalationService.createRule(orgId, bucket, role);
    }

    /** Manager-only: update an SLA escalation rule. */
    @PatchMapping("/escalation-rules/{ruleId}")
    public EscalationRule updateEscalationRule(
            @PathVariable Long orgId,
            @PathVariable Long ruleId,
            @RequestBody Map<String, Object> body) {
        requireSameOrg(orgId);
        SecurityUtils.requireRole("manager");
        String bucket = (String) body.get("agingBucket");
        String roleStr = (String) body.get("escalateToRole");
        Role role = roleStr != null ? Role.valueOf(roleStr) : null;
        Boolean active = body.containsKey("active") ? Boolean.TRUE.equals(body.get("active")) : null;
        return escalationService.updateRule(orgId, ruleId, bucket, role, active);
    }

    /** Manager-only: delete an SLA escalation rule. */
    @DeleteMapping("/escalation-rules/{ruleId}")
    public Map<String, Object> deleteEscalationRule(
            @PathVariable Long orgId,
            @PathVariable Long ruleId) {
        requireSameOrg(orgId);
        SecurityUtils.requireRole("manager");
        escalationService.deleteRule(orgId, ruleId);
        return Map.of("success", true, "deletedRuleId", ruleId);
    }

    /** P1 #34 -- escalation history log. */
    @GetMapping("/escalation-events")
    public List<EscalationEvent> escalationEvents(@PathVariable Long orgId) {
        requireSameOrg(orgId);
        SecurityUtils.requireRole("manager");
        return orgService.escalationHistory(orgId);
    }

    /** P1 #35 -- PTPs due within 24h, for a dashboard banner/notification. */
    @GetMapping("/ptp-alerts")
    public List<Ptp> ptpAlerts(@PathVariable Long orgId) {
        requireSameOrg(orgId);
        return orgService.ptpAlerts(orgId, SecurityUtils.currentUser());
    }

    /** P1 #44 -- org-wide reporting: DSO, CEI, aging trend. ?periodDays= (default 30). */
    @GetMapping("/reports")
    public Map<String, Object> reports(@PathVariable Long orgId,
                                        @RequestParam(required = false) Integer periodDays) {
        requireSameOrg(orgId);
        SecurityUtils.requireRole("manager");
        return orgService.orgReport(orgId, periodDays);
    }

    private void requireSameOrg(Long pathOrgId) {
        Long callerOrgId = SecurityUtils.requireOrgId();
        if (!callerOrgId.equals(pathOrgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization mismatch");
        }
    }
}
