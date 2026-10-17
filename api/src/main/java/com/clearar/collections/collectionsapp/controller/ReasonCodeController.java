package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.dto.ReasonCodeRequest;
import com.clearar.collections.collectionsapp.entity.ReasonCode;
import com.clearar.collections.collectionsapp.repository.ReasonCodeRepository;
import com.clearar.collections.collectionsapp.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * P0.5 #18 -- reason codes backing structured outcome capture (dispute resolution, PTP outcomes).
 * P1 #46 -- basic CRUD admin screen over this table, manager-only for writes; reads stay open to
 * any authenticated staff role so the outcome/dispute-resolution pickers keep working.
 */
@RestController
@RequestMapping("/api/reason-codes")
@RequiredArgsConstructor
public class ReasonCodeController {

    private final ReasonCodeRepository reasonCodeRepository;

    @GetMapping
    public List<ReasonCode> list() {
        Long orgId = SecurityUtils.requireOrgId();
        return reasonCodeRepository.findByOrgIdIsNullOrOrgId(orgId);
    }

    @PostMapping
    public ReasonCode create(@Valid @RequestBody ReasonCodeRequest req) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        if (reasonCodeRepository.existsByOrgIdAndCode(orgId, req.getCode()) ||
            reasonCodeRepository.existsByOrgIdIsNullAndCode(req.getCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reason code already exists: " + req.getCode());
        }
        ReasonCode rc = ReasonCode.builder()
                .orgId(orgId)
                .category(req.getCategory())
                .code(req.getCode())
                .label(req.getLabel())
                .build();
        return reasonCodeRepository.save(rc);
    }

    @PatchMapping("/{id}")
    public ReasonCode update(@PathVariable Long id, @RequestBody ReasonCodeRequest req) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        ReasonCode rc = reasonCodeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reason code not found"));
        if (rc.getOrgId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "System default reason codes cannot be modified");
        }
        if (!rc.getOrgId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Reason code not in your organization");
        }
        if (req.getCategory() != null) rc.setCategory(req.getCategory());
        if (req.getCode() != null && !req.getCode().equalsIgnoreCase(rc.getCode())) {
            if (reasonCodeRepository.existsByOrgIdAndCode(orgId, req.getCode()) ||
                reasonCodeRepository.existsByOrgIdIsNullAndCode(req.getCode())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reason code already exists: " + req.getCode());
            }
            rc.setCode(req.getCode());
        }
        if (req.getLabel() != null) rc.setLabel(req.getLabel());
        return reasonCodeRepository.save(rc);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        SecurityUtils.requireRole("manager");
        Long orgId = SecurityUtils.requireOrgId();
        ReasonCode rc = reasonCodeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reason code not found"));
        if (rc.getOrgId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "System default reason codes cannot be deleted");
        }
        if (!rc.getOrgId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Reason code not in your organization");
        }
        reasonCodeRepository.delete(rc);
    }
}
