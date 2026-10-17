package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.CoActorTaskUpdateRequest;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import com.clearar.collections.collectionsapp.service.CoActorTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * P1 #30 -- Co-actor task inbox (Relationship Owner view).
 * GET /api/co-actor-tasks?assignedTo=me, GET /api/co-actor-tasks/{id}, PATCH /api/co-actor-tasks/{id}.
 */
@RestController
@RequestMapping("/api/co-actor-tasks")
@RequiredArgsConstructor
public class CoActorTaskController {

    private final CoActorTaskService coActorTaskService;
    private final com.clearar.collections.collectionsapp.service.AccountService accountService;

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(required = false) String assignedTo) {
        com.clearar.collections.collectionsapp.security.AuthenticatedUser user = SecurityUtils.currentUser();
        Long userId = user.getUserId();
        Long orgId = SecurityUtils.requireOrgId();
        boolean isManager = user.hasRole("manager");
        boolean isCollector = user.hasRole("collector");

        String effectiveScope = (assignedTo != null && !assignedTo.isBlank())
                ? assignedTo
                : (isManager || isCollector ? "all" : "me");

        if ("all".equalsIgnoreCase(effectiveScope)) {
            SecurityUtils.requireRole("manager", "collector");
            java.util.Set<Long> visible = accountService.visibleAccountIds(orgId, user);
            List<Map<String, Object>> rows = coActorTaskService.forOrg(orgId);
            if (visible == null) {
                return rows;
            }
            return rows.stream().filter(r -> visible.contains(r.get("accountId"))).toList();
        }
        if (!"me".equalsIgnoreCase(effectiveScope)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "assignedTo must be 'me' or 'all'");
        }
        return coActorTaskService.forUser(userId, orgId);
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable Long id) {
        Long userId = SecurityUtils.currentUser().getUserId();
        Long orgId = SecurityUtils.requireOrgId();
        boolean isManager = SecurityUtils.currentUser().hasRole("manager");
        return coActorTaskService.detail(id, userId, orgId, isManager);
    }

    /** Mark done (or update status) with outcome notes. */
    @PatchMapping("/{id}")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody CoActorTaskUpdateRequest req) {
        com.clearar.collections.collectionsapp.security.AuthenticatedUser user = SecurityUtils.currentUser();
        if ("collector".equalsIgnoreCase(user.getRole())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    "Collectors cannot resolve or complete outreach requests. Outreach requests must be completed by the assigned relationship owner or manager.");
        }
        Long userId = user.getUserId();
        Long orgId = SecurityUtils.requireOrgId();
        boolean isManager = user.hasRole("manager");
        return coActorTaskService.update(id, userId, orgId, isManager, req.getStatus(), req.getOutcomeNotes());
    }

    /** Reassign task to another staff user in the organization (Manager only). */
    @PatchMapping("/{id}/reassign")
    public Map<String, Object> reassign(@PathVariable Long id, @RequestBody Map<String, Object> req) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        Object assignedToObj = req.get("assignedTo");
        if (assignedToObj == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "assignedTo is required");
        }
        Long newAssignedTo = Long.valueOf(assignedToObj.toString());
        return coActorTaskService.reassign(id, newAssignedTo, orgId);
    }
}
