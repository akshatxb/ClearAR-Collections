package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.InvoiceStatus;
import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.PaymentRepository;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.PaymentIntent;
import com.stripe.model.StripeObject;
import com.stripe.net.Webhook;
import com.stripe.param.PaymentIntentCreateParams;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * P1 #41 -- Pay-now (payment gateway), Stripe test mode.
 * POST /api/customer/pay creates a Stripe PaymentIntent for the invoice's remaining balance;
 * the client confirms it with Stripe.js, and the webhook below inserts into the payments
 * table on payment_intent.succeeded (rather than trusting a client-side "it worked" call).
 */
@Service
@RequiredArgsConstructor
public class StripePaymentService {

    private final InvoiceRepository invoiceRepository;
    private final AccountRepository accountRepository;
    private final PaymentService paymentService;
    private final InvoiceService invoiceService;
    private final PaymentRepository paymentRepository;

    @Value("${stripe.secret-key}")
    private String secretKey;

    @Value("${stripe.webhook-secret}")
    private String webhookSecret;

    @PostConstruct
    void init() {
        Stripe.apiKey = secretKey;
    }

    /** Creates a PaymentIntent for the invoice's outstanding balance, scoped to the caller's account. */
    public Map<String, Object> createPaymentIntent(Long invoiceId, Long customerAccountId) {
        return createPaymentIntent(invoiceId, customerAccountId, null);
    }

    /** Creates a PaymentIntent with an optional custom partial payment amount. */
    public Map<String, Object> createPaymentIntent(Long invoiceId, Long customerAccountId, BigDecimal customAmount) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found"));
        if (!invoice.getAccountId().equals(customerAccountId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invoice does not belong to this account");
        }
        if (invoice.getStatus() == InvoiceStatus.paid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice is already paid");
        }

        Account account = accountRepository.findById(customerAccountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));

        BigDecimal remainingBalance = invoiceService.getRemainingBalance(invoice);
        if (remainingBalance.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice has no remaining balance");
        }

        BigDecimal chargeAmount = remainingBalance;
        if (customAmount != null && customAmount.compareTo(BigDecimal.ZERO) > 0) {
            if (customAmount.compareTo(remainingBalance) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment amount cannot exceed remaining balance of " + remainingBalance);
            }
            chargeAmount = customAmount;
        }

        if (chargeAmount.compareTo(new BigDecimal("0.50")) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment amount must be at least $0.50 USD for card processing");
        }

        long amountInCents = chargeAmount.setScale(2, java.math.RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100)).longValue();

        try {
            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                    .setAmount(amountInCents)
                    .setCurrency("usd")
                    .putMetadata("invoiceId", String.valueOf(invoice.getId()))
                    .putMetadata("accountId", String.valueOf(account.getId()))
                    .setAutomaticPaymentMethods(
                            PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                                     .setEnabled(true)
                                     .build())
                    .build();
            PaymentIntent intent = PaymentIntent.create(params);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("clientSecret", intent.getClientSecret());
            result.put("paymentIntentId", intent.getId());
            result.put("amount", chargeAmount);
            result.put("invoiceId", invoice.getId());
            return result;
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Stripe error: " + e.getMessage());
        }
    }

    /**
     * Verifies the webhook signature, then on payment_intent.succeeded records a real payment
     * row (P0.2 #6 path) so the invoice status, PTP outcome, and priority score all update the
     * same way a manually-recorded payment would.
     */
    public void handleWebhook(String payload, String sigHeader) {
        Event event;
        try {
            event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
        } catch (SignatureVerificationException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Stripe signature");
        }

        if (!"payment_intent.succeeded".equals(event.getType())) {
            return; // ignore every other event type at hackathon scale
        }

        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        Optional<StripeObject> stripeObject = deserializer.getObject();
        if (stripeObject.isEmpty() || !(stripeObject.get() instanceof PaymentIntent intent)) {
            return;
        }

        String invoiceIdStr = intent.getMetadata() == null ? null : intent.getMetadata().get("invoiceId");
        if (invoiceIdStr == null) return;

        String method = "stripe:" + intent.getId();
        if (paymentRepository.existsByMethod(method)) {
            return;
        }

        Long invoiceId;
        try {
            invoiceId = Long.valueOf(invoiceIdStr);
        } catch (NumberFormatException e) {
            return;
        }

        BigDecimal amount = BigDecimal.valueOf(intent.getAmount()).movePointLeft(2);
        try {
            paymentService.record(invoiceId, amount, LocalDate.now(), method);
        } catch (ResponseStatusException e) {
            // Acknowledge webhook cleanly if invoice missing (404) or already settled (400) to prevent retry loops
        } catch (Exception e) {
            // Non-blocking acknowledgment
        }
    }
}
