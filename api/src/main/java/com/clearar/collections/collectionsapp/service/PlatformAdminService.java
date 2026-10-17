package com.clearar.collections.collectionsapp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.clearar.collections.collectionsapp.dto.PlatformAuditLogResponse;
import com.clearar.collections.collectionsapp.dto.UserSummary;
import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.*;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlatformAdminService {

    private static final String TEMP_PASSWORD_CHARS =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final PlatformAuditLogRepository platformAuditLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private final InvoiceService invoiceService;
    private final EmailService emailService;

    public List<Organization> list() {
        return organizationRepository.findAll();
    }

    public Organization getOrg(Long id) {
        return organizationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
    }

    @Transactional
    public Organization createOrg(String rawName) {
        String name = rawName != null ? rawName.trim() : "";
        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organization name cannot be blank");
        }
        if (organizationRepository.findByNameIgnoreCase(name).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An organization with this name already exists");
        }

        Organization org = Organization.builder().name(name).active(true).build();
        org = organizationRepository.save(org);

        logAudit("ORG_CREATED", org.getId(), null, Map.of("name", org.getName(), "active", org.isActive()));
        return org;
    }

    @Transactional
    public Organization updateOrg(Long orgId, String rawName) {
        String name = rawName != null ? rawName.trim() : "";
        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organization name cannot be blank");
        }

        Organization org = getOrg(orgId);

        Optional<Organization> duplicate = organizationRepository.findByNameIgnoreCase(name);
        if (duplicate.isPresent() && !duplicate.get().getId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An organization with this name already exists");
        }

        Map<String, Object> before = Map.of("name", org.getName());
        org.setName(name);
        org = organizationRepository.save(org);
        Map<String, Object> after = Map.of("name", org.getName());

        logAudit("ORG_EDITED", org.getId(), before, after);
        return org;
    }

    @Transactional
    public Organization deactivateOrg(Long orgId) {
        Organization org = getOrg(orgId);
        if (!org.isActive()) {
            return org;
        }

        Map<String, Object> before = Map.of("active", true);
        org.setActive(false);
        org = organizationRepository.save(org);
        Map<String, Object> after = Map.of("active", false);

        logAudit("ORG_DEACTIVATED", org.getId(), before, after);
        return org;
    }

    @Transactional
    public Organization reactivateOrg(Long orgId) {
        Organization org = getOrg(orgId);
        if (org.isActive()) {
            return org;
        }

        Map<String, Object> before = Map.of("active", false);
        org.setActive(true);
        org = organizationRepository.save(org);
        Map<String, Object> after = Map.of("active", true);

        logAudit("ORG_ACTIVATED", org.getId(), before, after);
        return org;
    }

    /**
     * Seeds/adds an org's manager. Returns temp password once.
     */
    @Transactional
    public Map<String, Object> seedManager(Long orgId, String email, String name) {
        Organization org = getOrg(orgId);
        if (!org.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Organization is not active");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        String tempPassword = generateTempPassword();
        User manager = User.builder()
                .orgId(orgId)
                .email(email)
                .name(name)
                .role(Role.manager)
                .passwordHash(passwordEncoder.encode(tempPassword))
                .active(true)
                .build();
        manager = userRepository.save(manager);

        Map<String, Object> after = new LinkedHashMap<>();
        after.put("userId", manager.getId());
        after.put("email", manager.getEmail());
        after.put("name", manager.getName());
        logAudit("MANAGER_ADDED", orgId, null, after);

        // Send manager invite email
        try {
            emailService.sendUserInvite(orgId, email, name, Role.manager.name(), tempPassword);
        } catch (Exception e) {
            // Non-blocking for manager seed transaction
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", manager.getId());
        result.put("email", manager.getEmail());
        result.put("tempPassword", tempPassword);
        return result;
    }

    public List<UserSummary> getOrgUsers(Long orgId) {
        getOrg(orgId);
        return userRepository.findByOrgId(orgId).stream()
                .map(UserSummary::of)
                .toList();
    }

    public Map<String, Object> getOrgSummary(Long orgId) {
        getOrg(orgId);
        List<User> users = userRepository.findByOrgId(orgId);
        List<Account> accounts = accountRepository.findByOrgId(orgId);
        List<Long> accountIds = accounts.stream().map(Account::getId).toList();
        List<Invoice> invoices = accountIds.isEmpty() ? List.of() : invoiceRepository.findByAccountIdIn(accountIds);

        BigDecimal totalOpenBalance = invoiceService.calculateOpenBalance(invoices);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("userCount", users.size());
        summary.put("accountCount", accounts.size());
        summary.put("invoiceCount", invoices.size());
        summary.put("totalOpenBalance", totalOpenBalance);
        return summary;
    }

    public Map<String, Object> getPlatformSummary() {
        List<Organization> orgs = organizationRepository.findAll();
        long activeCount = orgs.stream().filter(Organization::isActive).count();
        long inactiveCount = orgs.size() - activeCount;

        List<User> allStaff = userRepository.findAll().stream()
                .filter(u -> u.getOrgId() != null)
                .toList();

        List<Account> allAccounts = accountRepository.findAll();
        List<Invoice> allInvoices = invoiceRepository.findAll();

        BigDecimal totalReceivables = invoiceService.calculateOpenBalance(allInvoices);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalOrganizations", orgs.size());
        summary.put("activeOrganizations", activeCount);
        summary.put("inactiveOrganizations", inactiveCount);
        summary.put("totalStaffUsers", allStaff.size());
        summary.put("totalAccounts", allAccounts.size());
        summary.put("totalInvoices", allInvoices.size());
        summary.put("totalReceivables", totalReceivables);
        return summary;
    }

    public List<PlatformAuditLogResponse> getGlobalActivity() {
        List<PlatformAuditLog> logs = platformAuditLogRepository.findAllByOrderByCreatedAtDesc();
        Map<Long, User> userCache = new HashMap<>();
        Map<Long, String> orgCache = new HashMap<>();

        return logs.stream().map(l -> {
            User actor = userCache.computeIfAbsent(l.getActorUserId(), id -> userRepository.findById(id).orElse(null));
            String orgName = orgCache.computeIfAbsent(l.getTargetOrgId(), id ->
                    organizationRepository.findById(id).map(Organization::getName).orElse("Org #" + id));

            return PlatformAuditLogResponse.builder()
                    .id(l.getId())
                    .actorUserId(l.getActorUserId())
                    .actorName(actor != null ? actor.getName() : "Platform Admin")
                    .actorEmail(actor != null ? actor.getEmail() : "admin@platform")
                    .action(l.getAction())
                    .targetOrgId(l.getTargetOrgId())
                    .targetOrgName(orgName)
                    .beforeJson(l.getBeforeJson())
                    .afterJson(l.getAfterJson())
                    .createdAt(l.getCreatedAt())
                    .build();
        }).toList();
    }

    public List<PlatformAuditLogResponse> getOrgActivity(Long orgId) {
        getOrg(orgId);
        List<PlatformAuditLog> logs = platformAuditLogRepository.findByTargetOrgIdOrderByCreatedAtDesc(orgId);
        Map<Long, User> userCache = new HashMap<>();
        Organization org = getOrg(orgId);

        return logs.stream().map(l -> {
            User actor = userCache.computeIfAbsent(l.getActorUserId(), id -> userRepository.findById(id).orElse(null));
            return PlatformAuditLogResponse.builder()
                    .id(l.getId())
                    .actorUserId(l.getActorUserId())
                    .actorName(actor != null ? actor.getName() : "Platform Admin")
                    .actorEmail(actor != null ? actor.getEmail() : "admin@platform")
                    .action(l.getAction())
                    .targetOrgId(l.getTargetOrgId())
                    .targetOrgName(org.getName())
                    .beforeJson(l.getBeforeJson())
                    .afterJson(l.getAfterJson())
                    .createdAt(l.getCreatedAt())
                    .build();
        }).toList();
    }

    @Transactional
    public Map<String, Object> resetUserPassword(Long orgId, Long userId) {
        getOrg(orgId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!orgId.equals(user.getOrgId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User does not belong to this organization");
        }

        String tempPassword = generateTempPassword();
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        userRepository.save(user);

        Map<String, Object> after = Map.of("userId", user.getId(), "email", user.getEmail());
        logAudit("MANAGER_PASSWORD_RESET", orgId, null, after);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", user.getId());
        result.put("email", user.getEmail());
        result.put("tempPassword", tempPassword);
        return result;
    }

    public List<UserSummary> listPlatformAdmins() {
        return userRepository.findByRole(Role.platform_admin).stream()
                .map(UserSummary::of)
                .toList();
    }

    @Transactional
    public Map<String, Object> createPlatformAdmin(String email, String rawName) {
        String trimmedEmail = email != null ? email.trim().toLowerCase() : "";
        if (trimmedEmail.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }
        if (userRepository.findByEmail(trimmedEmail).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        String name = rawName != null && !rawName.isBlank()
                ? rawName.trim()
                : trimmedEmail.split("@")[0];

        String tempPassword = generateTempPassword();
        User admin = User.builder()
                .orgId(null)
                .email(trimmedEmail)
                .name(name)
                .role(Role.platform_admin)
                .passwordHash(passwordEncoder.encode(tempPassword))
                .active(true)
                .build();
        admin = userRepository.save(admin);

        Map<String, Object> after = new LinkedHashMap<>();
        after.put("userId", admin.getId());
        after.put("email", admin.getEmail());
        after.put("name", admin.getName());
        logAudit("PLATFORM_ADMIN_ADDED", 0L, null, after);

        // Send platform admin invite email
        try {
            emailService.sendUserInvite(null, trimmedEmail, name, Role.platform_admin.name(), tempPassword);
        } catch (Exception e) {
            // Non-blocking for platform admin creation transaction
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", admin.getId());
        result.put("email", admin.getEmail());
        result.put("tempPassword", tempPassword);
        return result;
    }

    @Transactional
    public UserSummary setPlatformAdminActive(Long userId, boolean active) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.getRole() != Role.platform_admin) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a platform admin");
        }

        Long currentActorId;
        try {
            currentActorId = SecurityUtils.currentUser().getUserId();
        } catch (Exception e) {
            currentActorId = 0L;
        }

        if (currentActorId.equals(userId) && !active) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot deactivate your own account");
        }

        if (!active) {
            long activeAdminCount = userRepository.findByRole(Role.platform_admin).stream()
                    .filter(User::isActive)
                    .count();
            if (activeAdminCount <= 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate the only active platform admin");
            }
        }

        Map<String, Object> before = Map.of("active", user.isActive());
        user.setActive(active);
        user = userRepository.save(user);
        Map<String, Object> after = Map.of("active", user.isActive());

        logAudit("PLATFORM_ADMIN_STATUS_CHANGED", 0L, before, after);
        return UserSummary.of(user);
    }

    @Transactional
    public Map<String, Object> resetPlatformAdminPassword(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.getRole() != Role.platform_admin) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a platform admin");
        }

        String tempPassword = generateTempPassword();
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        userRepository.save(user);

        Map<String, Object> after = Map.of("userId", user.getId(), "email", user.getEmail());
        logAudit("PLATFORM_ADMIN_PASSWORD_RESET", 0L, null, after);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", user.getId());
        result.put("email", user.getEmail());
        result.put("tempPassword", tempPassword);
        return result;
    }

    private void logAudit(String action, Long targetOrgId, Object before, Object after) {
        Long actorUserId;
        try {
            actorUserId = SecurityUtils.currentUser().getUserId();
        } catch (Exception e) {
            actorUserId = 1L;
        }

        String beforeJson = null;
        String afterJson = null;
        try {
            if (before != null) beforeJson = objectMapper.writeValueAsString(before);
            if (after != null) afterJson = objectMapper.writeValueAsString(after);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize audit log state", e);
        }

        PlatformAuditLog auditLog = PlatformAuditLog.builder()
                .actorUserId(actorUserId)
                .action(action)
                .targetOrgId(targetOrgId)
                .beforeJson(beforeJson)
                .afterJson(afterJson)
                .build();
        platformAuditLogRepository.save(auditLog);
    }

    private String generateTempPassword() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(TEMP_PASSWORD_CHARS.charAt(RANDOM.nextInt(TEMP_PASSWORD_CHARS.length())));
        }
        return sb.toString();
    }
}
