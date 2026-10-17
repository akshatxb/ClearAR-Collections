package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.dto.UserSummary;
import com.clearar.collections.collectionsapp.entity.Role;
import com.clearar.collections.collectionsapp.entity.User;
import com.clearar.collections.collectionsapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * P1 #47 -- user management (admin). Basic CRUD over users: invite (create with a temp
 * password), role assignment, deactivate. Never hard-deletes -- the `active` flag (already on
 * User) is the only way a user stops being usable, so history (created_by references etc.)
 * stays intact.
 */
@Service
@RequiredArgsConstructor
public class UserManagementService {

    private static final String TEMP_PASSWORD_CHARS =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final com.clearar.collections.collectionsapp.repository.AccountRepository accountRepository;
    private final com.clearar.collections.collectionsapp.repository.CommunicationRepository communicationRepository;

    public List<UserSummary> list(Long orgId) {
        return userRepository.findByOrgId(orgId).stream().map(UserSummary::of).collect(Collectors.toList());
    }

    /** Creates the user with a random temp password and returns it once -- never stored in plaintext. */
    public Map<String, Object> invite(Long orgId, String email, String name, String roleStr) {
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        Role role = parseInvitableRole(roleStr);

        String tempPassword = generateTempPassword();
        User user = User.builder()
                .orgId(orgId)
                .email(email)
                .name(name)
                .role(role)
                .passwordHash(passwordEncoder.encode(tempPassword))
                .active(true)
                .build();
        user = userRepository.save(user);

        // Send Welcome & Credential Email
        emailService.sendUserInvite(orgId, email, name, role.name(), tempPassword);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("user", UserSummary.of(user));
        result.put("tempPassword", tempPassword);
        return result;
    }

    public UserSummary updateRole(Long userId, Long orgId, String roleStr) {
        return updateRole(userId, orgId, roleStr, null);
    }

    public UserSummary updateRole(Long userId, Long orgId, String roleStr, Long callingUserId) {
        User user = getScoped(userId, orgId);
        Role newRole = parseInvitableRole(roleStr);
        if (user.getRole() == newRole) {
            return UserSummary.of(user);
        }
        if (user.getRole() == Role.manager && newRole != Role.manager) {
            if (callingUserId != null && user.getId().equals(callingUserId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot demote your own manager account");
            }
            long activeManagers = userRepository.findByOrgId(orgId).stream()
                    .filter(User::isActive)
                    .filter(u -> u.getRole() == Role.manager)
                    .count();
            if (activeManagers <= 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot demote the only active manager in the organization");
            }
        }
        Role oldRole = user.getRole();
        user.setRole(newRole);
        User savedUser = userRepository.save(user);

        // Clean up direct account collector assignments if no longer a collector:
        if (oldRole == Role.collector && newRole != Role.collector) {
            List<com.clearar.collections.collectionsapp.entity.Account> collectorAccounts =
                    accountRepository.findByOrgId(orgId).stream()
                            .filter(a -> userId.equals(a.getAssignedCollectorId()))
                            .toList();
            for (var acc : collectorAccounts) {
                acc.setAssignedCollectorId(null);
                accountRepository.save(acc);
                communicationRepository.save(com.clearar.collections.collectionsapp.entity.Communication.builder()
                        .accountId(acc.getId())
                        .type("note")
                        .content("Collector reassigned role to " + newRole.name() + ". Account unassigned from direct collector.")
                        .createdBy(callingUserId)
                        .build());
            }
        }

        // Clean up relationship owner assignments if no longer a relationship owner:
        if (oldRole == Role.relationship_owner && newRole != Role.relationship_owner) {
            List<com.clearar.collections.collectionsapp.entity.Account> ownerAccounts =
                    accountRepository.findByOrgIdAndRelationshipOwnerId(orgId, userId);
            for (var acc : ownerAccounts) {
                acc.setRelationshipOwnerId(null);
                accountRepository.save(acc);
                communicationRepository.save(com.clearar.collections.collectionsapp.entity.Communication.builder()
                        .accountId(acc.getId())
                        .type("note")
                        .content("Relationship owner reassigned role to " + newRole.name() + ". Owner assignment removed.")
                        .createdBy(callingUserId)
                        .build());
            }
        }

        return UserSummary.of(savedUser);
    }

    /**
     * A manager (this service is only ever called after requireRole("manager")) may only grant
     * the three staff roles that live inside their own org. Not customer (self-signup only --
     * see AuthService) and not platform_admin (a non-org-scoped, vendor-side role that would
     * otherwise let any manager mint themselves platform-wide access -- HANDOFF_NOTES.md #1).
     */
    private Role parseInvitableRole(String roleStr) {
        Role role;
        try {
            role = Role.valueOf(roleStr);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role");
        }
        if (role != Role.manager && role != Role.collector && role != Role.relationship_owner) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Role must be one of: manager, collector, relationship_owner");
        }
        return role;
    }

    /** Activate/deactivate -- never a hard delete, per spec. */
    public UserSummary setActive(Long userId, Long orgId, boolean active) {
        return setActive(userId, orgId, active, null);
    }

    public UserSummary setActive(Long userId, Long orgId, boolean active, Long callingUserId) {
        User user = getScoped(userId, orgId);
        if (!active) {
            if (callingUserId != null && user.getId().equals(callingUserId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate your own account");
            }
            if (user.getRole() == Role.manager) {
                long activeManagers = userRepository.findByOrgId(orgId).stream()
                        .filter(User::isActive)
                        .filter(u -> u.getRole() == Role.manager)
                        .count();
                if (activeManagers <= 1) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate the only active manager in the organization");
                }
            }
        }
        user.setActive(active);
        return UserSummary.of(userRepository.save(user));
    }

    /**
     * Self-service: update the calling user's own display name.
     * No org-scope check -- the caller is always updating themselves.
     */
    public Map<String, Object> updateProfile(Long userId, String name) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setName(name);
        userRepository.save(user);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("name", user.getName());
        return result;
    }

    /**
     * Self-service: change the calling user's own password after verifying the current one.
     * Throws 400 if the current password doesn't match.
     */
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    private User getScoped(Long userId, Long orgId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (user.getOrgId() == null || !user.getOrgId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User not in your organization");
        }
        return user;
    }

    private String generateTempPassword() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(TEMP_PASSWORD_CHARS.charAt(RANDOM.nextInt(TEMP_PASSWORD_CHARS.length())));
        }
        return sb.toString();
    }
}
