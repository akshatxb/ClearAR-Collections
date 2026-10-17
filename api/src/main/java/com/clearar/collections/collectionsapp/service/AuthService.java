package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.dto.AuthResponse;
import com.clearar.collections.collectionsapp.dto.LoginRequest;
import com.clearar.collections.collectionsapp.dto.SignupRequest;
import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Organization;
import com.clearar.collections.collectionsapp.entity.Role;
import com.clearar.collections.collectionsapp.entity.User;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.OrganizationRepository;
import com.clearar.collections.collectionsapp.repository.UserRepository;
import com.clearar.collections.collectionsapp.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.security.SecureRandom;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String TEMP_PASSWORD_CHARS =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final OrganizationRepository organizationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EmailService emailService;

    /**
     * HANDOFF_NOTES.md item #1 -- this used to let any caller self-declare ANY role (including
     * manager) plus an arbitrary orgId, with no check the org existed or that the caller had any
     * right to join it: an open bootstrapping path into every org, indefinitely. Staff accounts
     * (manager/collector/relationship_owner) are now created exclusively via
     * PlatformAdminService.seedManager() (an org's first manager) and
     * UserManagementService.invite() (everyone after that, manager-gated) -- never here.
     * /auth/signup is customer-only, tied to an accountId that must already exist.
     */
    public AuthResponse signup(SignupRequest req) {
        if (userRepository.findByEmail(req.getEmail()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        if (req.getAccountId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "accountId is required");
        }
        Account account = accountRepository.findById(req.getAccountId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown accountId"));

        if (userRepository.findByAccountId(req.getAccountId()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An online user is already registered for this account");
        }

        if (account.getContactEmail() == null || !account.getContactEmail().trim().equalsIgnoreCase(req.getEmail().trim())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Signup email must match the contact email on file for this account");
        }

        User user = User.builder()
                .email(req.getEmail())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .name(req.getName())
                .role(Role.customer)
                .orgId(null)
                .accountId(req.getAccountId())
                .active(true)
                .build();

        user = userRepository.save(user);
        return issueToken(user);
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account deactivated");
        }
        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        // Check if organization is deactivated (platform_admin is exempt)
        if (user.getRole() != Role.platform_admin) {
            Long orgIdToCheck = user.getOrgId();
            if (orgIdToCheck == null && user.getAccountId() != null) {
                orgIdToCheck = accountRepository.findById(user.getAccountId())
                        .map(Account::getOrgId)
                        .orElse(null);
            }
            if (orgIdToCheck != null) {
                Organization org = organizationRepository.findById(orgIdToCheck).orElse(null);
                if (org != null && !org.isActive()) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This organization has been deactivated");
                }
            }
        }

        return issueToken(user);
    }

    private AuthResponse issueToken(User user) {
        String orgName = null;
        String accountName = null;

        if (user.getOrgId() != null) {
            orgName = organizationRepository.findById(user.getOrgId())
                    .map(Organization::getName)
                    .orElse(null);
        } else if (user.getAccountId() != null) {
            Account acc = accountRepository.findById(user.getAccountId()).orElse(null);
            if (acc != null) {
                accountName = acc.getName();
                if (acc.getOrgId() != null) {
                    orgName = organizationRepository.findById(acc.getOrgId())
                            .map(Organization::getName)
                            .orElse(null);
                }
            }
        }

        String token = jwtUtil.generateToken(
                user.getId(), user.getEmail(), user.getRole().name(), user.getOrgId(), user.getAccountId(), orgName, accountName);
        return new AuthResponse(token, user.getRole().name(), user.getId(), user.getName(), orgName, accountName);
    }

    public Map<String, String> forgotPassword(String rawEmail) {
        if (rawEmail == null || rawEmail.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }

        String email = rawEmail.trim();
        userRepository.findByEmail(email).ifPresent(user -> {
            if (user.isActive()) {
                String tempPassword = generateTempPassword();
                user.setPasswordHash(passwordEncoder.encode(tempPassword));
                userRepository.save(user);

                try {
                    emailService.sendPasswordReset(user, tempPassword);
                } catch (Exception e) {
                    // Non-blocking for password reset transaction
                }
            }
        });

        return Map.of("message", "If your email is registered, a temporary password has been dispatched to your inbox.");
    }

    private String generateTempPassword() {
        StringBuilder sb = new StringBuilder(10);
        for (int i = 0; i < 10; i++) {
            sb.append(TEMP_PASSWORD_CHARS.charAt(RANDOM.nextInt(TEMP_PASSWORD_CHARS.length())));
        }
        return sb.toString();
    }
}
