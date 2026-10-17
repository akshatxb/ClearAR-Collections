package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.*;
import com.clearar.collections.collectionsapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * P0.9 #26 -- Seeded demo dataset, built early so every other feature has real data to show.
 * Inserts: 2 direct accounts, 2 indirect accounts (with a relationship owner), at least one
 * broken PTP, one resolved dispute, a spread of aging buckets and priority scores.
 *
 * HANDOFF_NOTES.md item #1 -- this writes an Organization row and a platform_admin user
 * directly via the repositories, bypassing PlatformAdminService entirely. That's intentional:
 * this class is dev-only bootstrap data, not the sanctioned provisioning path. Do not treat the
 * pattern here (raw User.builder().role(Role.manager)/.role(Role.platform_admin)) as a template
 * for anything reachable from the frontend -- real org/manager creation goes through
 * PlatformAdminController, and everyone after that first manager goes through
 * /api/users/invite.
 */
@Component
@RequiredArgsConstructor
public class SeedService implements CommandLineRunner {

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final PtpRepository ptpRepository;
    private final DisputeRepository disputeRepository;
    private final ReasonCodeRepository reasonCodeRepository;
    private final PriorityFactorRepository priorityFactorRepository;
    private final CommunicationRepository communicationRepository;
    private final PasswordEncoder passwordEncoder;
    private final ScoringService scoringService;
    private final OutcomeEventService outcomeEventService;

    @Override
    public void run(String... args) {
        if (!userRepository.findByEmail("manager@demo.com").isEmpty()) {
            return; // already seeded
        }

        // ---- Organization (dev-only direct write -- see class javadoc) ----
        Organization org = organizationRepository.save(
                Organization.builder().name("Demo Collections Org").active(true).build());
        Long ORG_ID = org.getId();

        // ---- Platform admin (dev-only direct write -- see class javadoc). Not org-scoped. ----
        userRepository.save(User.builder()
                .orgId(null).email("platform.admin@demo.com").passwordHash(passwordEncoder.encode("password123"))
                .name("Pat PlatformAdmin").role(Role.platform_admin).active(true).build());

        // ---- Reason codes ----
        reasonCodeRepository.saveAll(List.of(
                ReasonCode.builder().category("payment").code("payment_processed").label("Payment Processed").build(),
                ReasonCode.builder().category("customer").code("customer_cashflow_issue").label("Customer Cash Flow Issue").build(),
                ReasonCode.builder().category("billing").code("invoice_error").label("Invoice Error").build(),
                ReasonCode.builder().category("internal").code("internal_delay").label("Internal Processing Delay").build(),
                ReasonCode.builder().category("customer").code("customer_dispute_valid").label("Customer Dispute Was Valid").build(),
                ReasonCode.builder().category("customer").code("no_response").label("No Response From Customer").build()
        ));

        // ---- Priority factors (defaults) ----
        scoringService.defaultFactors(ORG_ID);

        // ---- Users ----
        User manager = userRepository.save(User.builder()
                .orgId(ORG_ID).email("manager@demo.com").passwordHash(passwordEncoder.encode("password123"))
                .name("Morgan Manager").role(Role.manager).active(true).build());

        User collector = userRepository.save(User.builder()
                .orgId(ORG_ID).email("collector@demo.com").passwordHash(passwordEncoder.encode("password123"))
                .name("Casey Collector").role(Role.collector).active(true).build());

        User relOwner = userRepository.save(User.builder()
                .orgId(ORG_ID).email("owner@demo.com").passwordHash(passwordEncoder.encode("password123"))
                .name("Riley Owner").role(Role.relationship_owner).active(true).build());

        // ---- Accounts: 2 direct, 2 indirect ----
        Account direct1 = accountRepository.save(Account.builder()
                .orgId(ORG_ID).name("Acme Manufacturing").contactEmail("ap@acme.example.com")
                .contactPhone("555-0101").creditTerms("Net 30").ownershipMode("direct")
                .assignedCollectorId(collector.getId())
                .creditHold(false).build());

        Account direct2 = accountRepository.save(Account.builder()
                .orgId(ORG_ID).name("Blue Ridge Supplies").contactEmail("billing@blueridge.example.com")
                .contactPhone("555-0102").creditTerms("Net 45").ownershipMode("direct")
                .creditHold(false).build());

        Account indirect1 = accountRepository.save(Account.builder()
                .orgId(ORG_ID).name("Continental Freight Co").contactEmail("finance@continental.example.com")
                .contactPhone("555-0103").creditTerms("Net 30").ownershipMode("indirect")
                .relationshipOwnerId(relOwner.getId()).creditHold(false).build());

        Account indirect2 = accountRepository.save(Account.builder()
                .orgId(ORG_ID).name("Delta Retail Group").contactEmail("ap@deltaretail.example.com")
                .contactPhone("555-0104").creditTerms("Net 60").ownershipMode("indirect")
                .relationshipOwnerId(relOwner.getId()).creditHold(true).build());

        // ---- Customer User (Acme Manufacturing) ----
        userRepository.save(User.builder()
                .orgId(null).accountId(direct1.getId()).email("customer@demo.com")
                .passwordHash(passwordEncoder.encode("password123"))
                .name("Alex Acme").role(Role.customer).active(true).build());

        // ---- Invoices spread across aging buckets ----
        Invoice inv1 = invoiceRepository.save(Invoice.builder().accountId(direct1.getId())
                .amount(new BigDecimal("4200.00")).dueDate(LocalDate.now().minusDays(10))
                .status(InvoiceStatus.open).issuedDate(LocalDate.now().minusDays(40)).build());

        Invoice inv2 = invoiceRepository.save(Invoice.builder().accountId(direct1.getId())
                .amount(new BigDecimal("1500.00")).dueDate(LocalDate.now().minusDays(45))
                .status(InvoiceStatus.open).issuedDate(LocalDate.now().minusDays(75)).build());

        Invoice inv3 = invoiceRepository.save(Invoice.builder().accountId(direct2.getId())
                .amount(new BigDecimal("980.00")).dueDate(LocalDate.now().minusDays(5))
                .status(InvoiceStatus.paid).issuedDate(LocalDate.now().minusDays(35)).build());
        paymentRepository.save(Payment.builder().invoiceId(inv3.getId()).amount(new BigDecimal("980.00"))
                .paidDate(LocalDate.now().minusDays(2)).method("ach").build());

        Invoice inv4 = invoiceRepository.save(Invoice.builder().accountId(direct2.getId())
                .amount(new BigDecimal("7600.00")).dueDate(LocalDate.now().minusDays(95))
                .status(InvoiceStatus.open).issuedDate(LocalDate.now().minusDays(125)).build());

        Invoice inv5 = invoiceRepository.save(Invoice.builder().accountId(indirect1.getId())
                .amount(new BigDecimal("3100.00")).dueDate(LocalDate.now().minusDays(70))
                .status(InvoiceStatus.disputed).issuedDate(LocalDate.now().minusDays(100)).build());

        Invoice inv6 = invoiceRepository.save(Invoice.builder().accountId(indirect2.getId())
                .amount(new BigDecimal("12500.00")).dueDate(LocalDate.now().minusDays(20))
                .status(InvoiceStatus.open).issuedDate(LocalDate.now().minusDays(50)).build());

        // ---- PTPs: one broken, one pending ----
        Ptp brokenPtp = ptpRepository.save(Ptp.builder().accountId(direct2.getId())
                .promisedAmount(new BigDecimal("7600.00")).promisedDate(LocalDate.now().minusDays(3))
                .status(PtpStatus.broken).createdBy(collector.getId()).build());

        ptpRepository.save(Ptp.builder().accountId(direct1.getId())
                .promisedAmount(new BigDecimal("1500.00")).promisedDate(LocalDate.now().plusDays(5))
                .status(PtpStatus.pending).createdBy(collector.getId()).build());

        // ---- Disputes: one resolved, one open ----
        Dispute resolvedDispute = disputeRepository.save(Dispute.builder().accountId(indirect1.getId())
                .reason("Customer claims partial shipment was never received")
                .status(DisputeStatus.resolved).createdBy(relOwner.getId())
                .reasonCodeId(5L).resolvedAt(java.time.Instant.now().minusSeconds(86400)).build());

        disputeRepository.save(Dispute.builder().accountId(indirect2.getId())
                .reason("Pricing discrepancy on invoice #INV-2201")
                .status(DisputeStatus.open).createdBy(relOwner.getId()).build());

        // ---- Communications ----
        communicationRepository.save(Communication.builder().accountId(direct1.getId())
                .type("note").content("Spoke with AP contact, payment expected next week.")
                .createdBy(collector.getId()).build());

        communicationRepository.save(Communication.builder().accountId(direct2.getId())
                .type("email").content("Sent 90+ day escalation reminder.")
                .createdBy(collector.getId()).build());

        // ---- Compute initial scores for every account ----
        for (Account acc : List.of(direct1, direct2, indirect1, indirect2)) {
            scoringService.computeAccountScore(acc.getId(), ORG_ID);
        }

        // ---- Outcome events for the seeded broken PTP + resolved dispute ----
        outcomeEventService.recordEvent(direct2.getId(), "ptp_broken", null, brokenPtp.getId());
        outcomeEventService.recordEvent(indirect1.getId(), "dispute_resolved", 5L, resolvedDispute.getId());

        System.out.println("=== Demo data seeded ===");
        System.out.println("platform.admin@demo.com / password123  (platform_admin, not org-scoped)");
        System.out.println("manager@demo.com / password123  (org_id=" + ORG_ID + ")");
        System.out.println("collector@demo.com / password123");
        System.out.println("owner@demo.com / password123");
        System.out.println("Customer login: customer@demo.com / password123 (Acme Manufacturing)");
    }
}
