package com.clearar.collections.collectionsapp.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.clearar.collections.collectionsapp.entity.Role;
import com.clearar.collections.collectionsapp.entity.User;
import com.clearar.collections.collectionsapp.entity.Organization;
import com.clearar.collections.collectionsapp.repository.UserRepository;
import com.clearar.collections.collectionsapp.repository.OrganizationRepository;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;

    public JwtAuthFilter(JwtUtil jwtUtil, UserRepository userRepository, OrganizationRepository organizationRepository) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.isValid(token)) {
                Claims claims = jwtUtil.parseClaims(token);

                Long userId = claims.get("userId") != null
                        ? Long.valueOf(claims.get("userId").toString()) : null;

                if (userId != null) {
                    Optional<User> userOpt = userRepository.findById(userId);
                    if (userOpt.isEmpty() || !userOpt.get().isActive()) {
                        filterChain.doFilter(request, response);
                        return;
                    }

                    User user = userOpt.get();
                    if (user.getRole() != Role.platform_admin) {
                        Long orgId = user.getOrgId();
                        if (orgId != null && orgId > 0) {
                            Optional<Organization> orgOpt = organizationRepository.findById(orgId);
                            if (orgOpt.isEmpty() || !orgOpt.get().isActive()) {
                                filterChain.doFilter(request, response);
                                return;
                            }
                        }
                    }

                    String email = claims.getSubject();
                    String role = claims.get("role", String.class);
                    Long orgId = claims.get("orgId") != null ? Long.valueOf(claims.get("orgId").toString()) : null;
                    Long accountId = claims.get("accountId") != null ? Long.valueOf(claims.get("accountId").toString()) : null;

                    AuthenticatedUser principal = new AuthenticatedUser(userId, email, role, orgId, accountId);

                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
