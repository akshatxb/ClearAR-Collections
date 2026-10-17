package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.Role;
import com.clearar.collections.collectionsapp.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    /** P1 #32 -- pick an escalation target: the first active user with a given role in the org. */
    List<User> findByOrgIdAndRoleAndActiveTrue(Long orgId, Role role);

    /** P1 #47 -- user management (admin): list every staff user in the org. */
    List<User> findByOrgId(Long orgId);

    /** List users by role (e.g. platform_admin). */
    List<User> findByRole(Role role);

    /** Find customer user associated with an account. */
    Optional<User> findByAccountId(Long accountId);
}
