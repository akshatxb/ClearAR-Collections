package com.clearar.collections.collectionsapp.controller;

import com.clearar.collections.collectionsapp.service.StripePaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * P1 #41 -- Stripe webhook. Public endpoint (no JWT -- Stripe can't send one); the signature
 * header is what proves authenticity instead. Permitted anonymously in SecurityConfig.
 */
@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
public class WebhookController {

    private final StripePaymentService stripePaymentService;

    @PostMapping("/stripe")
    public void stripeWebhook(@RequestBody String payload, @RequestHeader("Stripe-Signature") String sigHeader) {
        stripePaymentService.handleWebhook(payload, sigHeader);
    }
}
