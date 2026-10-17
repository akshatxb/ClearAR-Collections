package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.dto.AuthResponse;
import com.clearar.collections.collectionsapp.dto.SignupRequest;
import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Role;
import com.clearar.collections.collectionsapp.entity.User;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.OrganizationRepository;
import com.clearar.collections.collectionsapp.repository.UserRepository;
import com.clearar.collections.collectionsapp.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private OrganizationRepository organizationRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private EmailService emailService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, accountRepository, organizationRepository, passwordEncoder, jwtUtil, emailService);
    }

    @Test
    void signup_emailMismatch_throwsForbidden() {
        SignupRequest req = new SignupRequest();
        req.setEmail("attacker@evil.com");
        req.setPassword("secret123");
        req.setName("Attacker");
        req.setAccountId(1L);

        Account account = Account.builder().id(1L).contactEmail("victim@company.com").build();
        when(accountRepository.findById(1L)).thenReturn(Optional.of(account));
        when(userRepository.findByEmail("attacker@evil.com")).thenReturn(Optional.empty());
        when(userRepository.findByAccountId(1L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> authService.signup(req));
        assertEquals(403, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("Signup email must match"));
    }

    @Test
    void signup_duplicateAccountUser_throwsConflict() {
        SignupRequest req = new SignupRequest();
        req.setEmail("contact@company.com");
        req.setPassword("secret123");
        req.setName("Contact User");
        req.setAccountId(1L);

        Account account = Account.builder().id(1L).contactEmail("contact@company.com").build();
        User existingUser = User.builder().id(20L).accountId(1L).email("firstuser@company.com").build();

        when(userRepository.findByEmail("contact@company.com")).thenReturn(Optional.empty());
        when(accountRepository.findById(1L)).thenReturn(Optional.of(account));
        when(userRepository.findByAccountId(1L)).thenReturn(Optional.of(existingUser));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> authService.signup(req));
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("already registered for this account"));
    }

    @Test
    void signup_validMatchingEmail_succeeds() {
        SignupRequest req = new SignupRequest();
        req.setEmail("contact@company.com");
        req.setPassword("secret123");
        req.setName("Contact Person");
        req.setAccountId(1L);

        Account account = Account.builder().id(1L).contactEmail("contact@company.com").build();
        User savedUser = User.builder()
                .id(10L)
                .email("contact@company.com")
                .name("Contact Person")
                .role(Role.customer)
                .accountId(1L)
                .active(true)
                .build();

        when(userRepository.findByEmail("contact@company.com")).thenReturn(Optional.empty());
        when(accountRepository.findById(1L)).thenReturn(Optional.of(account));
        when(userRepository.findByAccountId(1L)).thenReturn(Optional.empty());
        when(passwordEncoder.encode("secret123")).thenReturn("hashedPass");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtUtil.generateToken(any(), any(), any(), any(), any(), any(), any())).thenReturn("fake-jwt-token");

        AuthResponse resp = authService.signup(req);
        assertNotNull(resp);
        assertEquals("fake-jwt-token", resp.getAccessToken());
        assertEquals(Role.customer.name(), resp.getRole());
    }

    @Test
    void forgotPassword_existingActiveUser_generatesNewHashAndDispatchesEmail() {
        User user = User.builder()
                .id(1L)
                .email("user@example.com")
                .name("Test User")
                .passwordHash("oldHash")
                .active(true)
                .build();

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode(anyString())).thenReturn("newHashedPassword");

        var resp = authService.forgotPassword("user@example.com");

        assertNotNull(resp);
        assertTrue(resp.get("message").contains("temporary password"));
        assertEquals("newHashedPassword", user.getPasswordHash());
        verify(userRepository).save(user);
        verify(emailService).sendPasswordReset(eq(user), anyString());
    }

    @Test
    void forgotPassword_unknownUser_returnsGenericMessageWithoutError() {
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        var resp = authService.forgotPassword("unknown@example.com");

        assertNotNull(resp);
        assertTrue(resp.get("message").contains("temporary password"));
        verify(userRepository, never()).save(any());
        verify(emailService, never()).sendPasswordReset(any(), any());
    }
}
