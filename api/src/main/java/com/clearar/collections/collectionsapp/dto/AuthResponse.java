package com.clearar.collections.collectionsapp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String role;
    private Long userId;
    private String name;
    private String orgName;
    private String accountName;
}
