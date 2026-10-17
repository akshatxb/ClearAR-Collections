package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Role;
import com.clearar.collections.collectionsapp.entity.User;
import com.clearar.collections.collectionsapp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserManagementServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private EmailService emailService;
    @Mock
    private com.clearar.collections.collectionsapp.repository.AccountRepository accountRepository;
    @Mock
    private com.clearar.collections.collectionsapp.repository.CommunicationRepository communicationRepository;

    private UserManagementService userManagementService;

    @BeforeEach
    void setUp() {
        userManagementService = new UserManagementService(userRepository, passwordEncoder, emailService, accountRepository, communicationRepository);
    }

    @Test
    void updateRole_selfDemotion_throwsBadRequest() {
        Long orgId = 1L;
        Long userId = 10L;
        User manager = User.builder().id(userId).orgId(orgId).role(Role.manager).active(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(manager));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                userManagementService.updateRole(userId, orgId, "collector", userId));
        assertTrue(ex.getReason().contains("Cannot demote your own manager account"));
    }

    @Test
    void updateRole_soleManagerDemotion_throwsBadRequest() {
        Long orgId = 1L;
        Long userId = 10L;
        Long callingUserId = 99L;
        User manager = User.builder().id(userId).orgId(orgId).role(Role.manager).active(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(manager));
        when(userRepository.findByOrgId(orgId)).thenReturn(List.of(manager));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                userManagementService.updateRole(userId, orgId, "collector", callingUserId));
        assertTrue(ex.getReason().contains("Cannot demote the only active manager"));
    }

    @Test
    void setActive_selfDeactivation_throwsBadRequest() {
        Long orgId = 1L;
        Long userId = 10L;
        User manager = User.builder().id(userId).orgId(orgId).role(Role.manager).active(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(manager));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                userManagementService.setActive(userId, orgId, false, userId));
        assertTrue(ex.getReason().contains("Cannot deactivate your own account"));
    }

    @Test
    void setActive_soleManagerDeactivation_throwsBadRequest() {
        Long orgId = 1L;
        Long userId = 10L;
        Long callingUserId = 99L;
        User manager = User.builder().id(userId).orgId(orgId).role(Role.manager).active(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(manager));
        when(userRepository.findByOrgId(orgId)).thenReturn(List.of(manager));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                userManagementService.setActive(userId, orgId, false, callingUserId));
        assertTrue(ex.getReason().contains("Cannot deactivate the only active manager"));
    }
}
