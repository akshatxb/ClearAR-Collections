package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Communication;
import com.clearar.collections.collectionsapp.repository.CommunicationRepository;
import com.clearar.collections.collectionsapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/** P0.4 #13-15 -- communication history + manual notes + reminder sending. */
@Service
@RequiredArgsConstructor
public class CommunicationService {

    private final CommunicationRepository communicationRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    public List<Communication> history(Long accountId) {
        List<Communication> list = communicationRepository.findByAccountIdOrderByCreatedAtDesc(accountId);
        enrichWithCreatedByName(list);
        return list;
    }

    public Communication log(Long accountId, String type, String content, Integer durationSeconds, Long createdBy) {
        Communication c = Communication.builder()
                .accountId(accountId)
                .type(type)
                .content(content)
                .durationSeconds(durationSeconds)
                .createdBy(createdBy)
                .build();
        Communication saved = communicationRepository.save(c);
        if (createdBy != null) {
            userRepository.findById(createdBy).ifPresent(u -> saved.setCreatedByName(u.getName()));
        }
        return saved;
    }

    public void enrichWithCreatedByName(List<Communication> communications) {
        if (communications == null || communications.isEmpty()) return;
        Set<Long> userIds = communications.stream()
                .map(Communication::getCreatedBy)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (userIds.isEmpty()) return;
        Map<Long, String> userNames = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(u -> u.getId(), u -> u.getName(), (a, b) -> a));
        for (Communication c : communications) {
            if (c.getCreatedBy() != null) {
                c.setCreatedByName(userNames.get(c.getCreatedBy()));
            }
        }
    }

    /** #15 -- template stored as a static string keyed by aging bucket. Also dispatches rich email via EmailService. */
    public Communication sendReminder(Account account, String agingBucket, Long createdBy) {
        String template = reminderTemplate(agingBucket, account.getName());
        emailService.sendDunningReminder(account, agingBucket, createdBy);
        return log(account.getId(), "email", template, null, createdBy);
    }

    private String reminderTemplate(String agingBucket, String accountName) {
        return switch (agingBucket == null ? "current" : agingBucket) {
            case "current" -> "Hi " + accountName + ", friendly reminder that your upcoming invoice will be due shortly.";
            case "0-30" -> "Hi " + accountName + ", friendly reminder that your invoice is coming due soon.";
            case "31-60" -> "Hi " + accountName + ", your invoice is now past due -- please arrange payment at your earliest convenience.";
            case "61-90" -> "Hi " + accountName + ", your account balance is significantly overdue. Please contact us to resolve this promptly.";
            default -> "Hi " + accountName + ", your account requires immediate attention -- please contact us regarding your seriously overdue balance.";
        };
    }
}
