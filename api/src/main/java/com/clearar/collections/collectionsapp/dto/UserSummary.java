package com.clearar.collections.collectionsapp.dto;

import com.clearar.collections.collectionsapp.entity.User;
import lombok.Data;

import java.time.Instant;

@Data
public class UserSummary {
    private Long id;
    private String email;
    private String name;
    private String role;
    private boolean active;
    private Instant createdAt;

    public static UserSummary of(User u) {
        UserSummary s = new UserSummary();
        s.setId(u.getId());
        s.setEmail(u.getEmail());
        s.setName(u.getName());
        s.setRole(u.getRole().name());
        s.setActive(u.isActive());
        s.setCreatedAt(u.getCreatedAt());
        return s;
    }
}
