package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.CoActorTask;
import com.clearar.collections.collectionsapp.entity.Role;
import com.clearar.collections.collectionsapp.entity.User;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.CoActorTaskRepository;
import com.clearar.collections.collectionsapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * P1 #30 -- Co-actor task inbox (Relationship Owner view + Manager oversight).
 */
@Service
@RequiredArgsConstructor
public class CoActorTaskService {

    private final CoActorTaskRepository coActorTaskRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final CommunicationService communicationService;
    private final NotificationService notificationService;
    private final ScoringService scoringService;

    /** GET /api/co-actor-tasks?assignedTo=me */
    public List<Map<String, Object>> forUser(Long userId, Long orgId) {
        List<Account> accounts = accountRepository.findByOrgId(orgId);
        if (accounts.isEmpty()) {
            return List.of();
        }
        java.util.Set<Long> accountIds = accounts.stream().map(Account::getId).collect(Collectors.toSet());
        return coActorTaskRepository.findByAssignedTo(userId).stream()
                .filter(task -> accountIds.contains(task.getAccountId()))
                .map(task -> toRow(task, orgId))
                .collect(Collectors.toList());
    }

    /** GET /api/co-actor-tasks?assignedTo=all (Manager only) */
    public List<Map<String, Object>> forOrg(Long orgId) {
        List<Account> accounts = accountRepository.findByOrgId(orgId);
        if (accounts.isEmpty()) {
            return List.of();
        }
        List<Long> accountIds = accounts.stream().map(Account::getId).toList();
        return coActorTaskRepository.findByAccountIdIn(accountIds).stream()
                .map(task -> toRow(task, orgId))
                .collect(Collectors.toList());
    }

    public Map<String, Object> detail(Long taskId, Long userId, Long orgId, boolean isManager) {
        CoActorTask task = getAccessible(taskId, userId, orgId, isManager);
        return toRow(task, orgId);
    }

    /** PATCH -- mark done (or otherwise update status) with outcome notes. */
    public Map<String, Object> update(Long taskId, Long userId, Long orgId, boolean isManager, String status, String outcomeNotes) {
        CoActorTask task = getAccessible(taskId, userId, orgId, isManager);
        String previousStatus = task.getStatus();
        if (status != null && !status.isBlank()) {
            task.setStatus(status);
        }
        if (outcomeNotes != null) {
            task.setOutcomeNotes(outcomeNotes);
        }
        task = coActorTaskRepository.save(task);

        // When outreach task is completed, close the loop:
        if ("done".equalsIgnoreCase(status) && !"done".equalsIgnoreCase(previousStatus)) {
            String noteContent = (outcomeNotes != null && !outcomeNotes.isBlank())
                    ? "[Outreach Completed] " + outcomeNotes
                    : "Outreach request marked as completed by relationship owner";

            // 1. Log communication to account timeline
            communicationService.log(task.getAccountId(), "outreach", noteContent, null, userId);

            // 2. Re-score account to refresh priority/activity
            try {
                scoringService.computeAccountScore(task.getAccountId(), orgId);
            } catch (Exception ignored) {}

            // 3. Notify the requesting user (collector or manager)
            if (task.getRequestedBy() != null && !task.getRequestedBy().equals(userId)) {
                String completedByName = userRepository.findById(userId).map(User::getName).orElse("Relationship owner");
                String accountName = accountRepository.findById(task.getAccountId()).map(Account::getName).orElse("Account #" + task.getAccountId());
                notificationService.notify(task.getRequestedBy(), "outreach_completed", Map.of(
                        "accountId", task.getAccountId(),
                        "taskId", task.getId(),
                        "accountName", accountName,
                        "completedByName", completedByName,
                        "outcomeNotes", outcomeNotes != null ? outcomeNotes : ""
                ));
            }
        }

        return toRow(task, orgId);
    }

    /** PATCH /api/co-actor-tasks/{id}/reassign -- manager only */
    public Map<String, Object> reassign(Long taskId, Long newAssignedTo, Long orgId) {
        CoActorTask task = coActorTaskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        Account account = accountRepository.findById(task.getAccountId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        if (!account.getOrgId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not in your organization");
        }
        User targetUser = userRepository.findById(newAssignedTo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target user not found"));
        if (!orgId.equals(targetUser.getOrgId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target user is not in this organization");
        }
        if (targetUser.getRole() != Role.relationship_owner) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Outreach requests can only be assigned to relationship owners");
        }
        task.setAssignedTo(newAssignedTo);
        task = coActorTaskRepository.save(task);
        return toRow(task, orgId);
    }

    private CoActorTask getAccessible(Long taskId, Long userId, Long orgId, boolean isManager) {
        CoActorTask task = coActorTaskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        Account account = accountRepository.findById(task.getAccountId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        if (!account.getOrgId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not in your organization");
        }
        boolean isAssignee = task.getAssignedTo().equals(userId);
        boolean isRequester = task.getRequestedBy() != null && task.getRequestedBy().equals(userId);
        if (!isManager && !isAssignee && !isRequester) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your task");
        }
        return task;
    }

    private Map<String, Object> toRow(CoActorTask task, Long orgId) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", task.getId());
        row.put("accountId", task.getAccountId());
        row.put("assignedTo", task.getAssignedTo());
        row.put("requestType", task.getRequestType());
        row.put("notes", task.getNotes());
        row.put("status", task.getStatus());
        row.put("outcomeNotes", task.getOutcomeNotes());
        row.put("createdAt", task.getCreatedAt());

        accountRepository.findById(task.getAccountId())
                .filter(a -> a.getOrgId().equals(orgId))
                .ifPresent(a -> {
                    row.put("accountName", a.getName());
                    row.put("contactEmail", a.getContactEmail());
                    row.put("contactPhone", a.getContactPhone());
                    row.put("creditHold", a.isCreditHold());
                });
        userRepository.findById(task.getAssignedTo())
                .ifPresent(u -> {
                    row.put("assignedToName", u.getName());
                    row.put("assignedToRole", u.getRole() != null ? u.getRole().name() : "");
                });
        if (task.getRequestedBy() != null) {
            row.put("requestedBy", task.getRequestedBy());
            userRepository.findById(task.getRequestedBy())
                    .ifPresent(u -> {
                        row.put("requestedByName", u.getName());
                        row.put("requestedByRole", u.getRole() != null ? u.getRole().name() : "");
                    });
        }
        return row;
    }
}
