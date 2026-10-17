package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.Ptp;
import com.clearar.collections.collectionsapp.entity.PtpStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface PtpRepository extends JpaRepository<Ptp, Long> {
    List<Ptp> findByAccountId(Long accountId);
    List<Ptp> findByAccountIdIn(List<Long> accountIds);
    List<Ptp> findByStatus(PtpStatus status);
    List<Ptp> findByStatusAndPromisedDateLessThanEqual(PtpStatus status, LocalDate date);
    List<Ptp> findByAccountIdInAndStatusAndPromisedDateLessThanEqual(List<Long> accountIds, PtpStatus status, LocalDate date);

    /** P1 #35 -- due-date reminders: pending PTPs across an org's accounts due within a date range. */
    List<Ptp> findByAccountIdInAndStatusAndPromisedDateBetween(List<Long> accountIds, PtpStatus status, LocalDate from, LocalDate to);

    /** P1 #40 -- personal performance dashboard: PTP kept-rate for this collector. */
    List<Ptp> findByCreatedBy(Long userId);
}
