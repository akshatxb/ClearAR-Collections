package com.clearar.collections.collectionsapp.service;

import com.clearar.collections.collectionsapp.repository.AccountRepository;
import com.clearar.collections.collectionsapp.repository.InvoiceRepository;
import com.clearar.collections.collectionsapp.repository.PaymentRepository;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.PaymentIntent;
import com.stripe.net.Webhook;
import com.clearar.collections.collectionsapp.entity.Account;
import com.clearar.collections.collectionsapp.entity.Invoice;
import com.clearar.collections.collectionsapp.entity.InvoiceStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StripePaymentServiceTest {

    @Mock
    private InvoiceRepository invoiceRepository;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private PaymentService paymentService;
    @Mock
    private InvoiceService invoiceService;
    @Mock
    private PaymentRepository paymentRepository;

    private StripePaymentService stripePaymentService;

    @BeforeEach
    void setUp() {
        stripePaymentService = new StripePaymentService(
                invoiceRepository,
                accountRepository,
                paymentService,
                invoiceService,
                paymentRepository
        );
        ReflectionTestUtils.setField(stripePaymentService, "webhookSecret", "whsec_test");
    }

    @Test
    void handleWebhook_duplicateEvent_isIgnoredIdempotently() {
        Event event = mock(Event.class);
        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        PaymentIntent intent = mock(PaymentIntent.class);

        when(event.getType()).thenReturn("payment_intent.succeeded");
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);
        when(deserializer.getObject()).thenReturn(Optional.of(intent));
        when(intent.getMetadata()).thenReturn(Map.of("invoiceId", "123"));
        when(intent.getId()).thenReturn("pi_123456");

        when(paymentRepository.existsByMethod("stripe:pi_123456")).thenReturn(true);

        try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
            mockedWebhook.when(() -> Webhook.constructEvent(eq("payload"), eq("sig"), eq("whsec_test")))
                    .thenReturn(event);

            stripePaymentService.handleWebhook("payload", "sig");

            verify(paymentService, never()).record(any(), any(), any(), any());
        }
    }

    @Test
    void handleWebhook_newEvent_recordsPayment() {
        Event event = mock(Event.class);
        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        PaymentIntent intent = mock(PaymentIntent.class);

        when(event.getType()).thenReturn("payment_intent.succeeded");
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);
        when(deserializer.getObject()).thenReturn(Optional.of(intent));
        when(intent.getMetadata()).thenReturn(Map.of("invoiceId", "123"));
        when(intent.getId()).thenReturn("pi_999999");
        when(intent.getAmount()).thenReturn(5000L); // $50.00

        when(paymentRepository.existsByMethod("stripe:pi_999999")).thenReturn(false);

        try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
            mockedWebhook.when(() -> Webhook.constructEvent(eq("payload"), eq("sig"), eq("whsec_test")))
                    .thenReturn(event);

            stripePaymentService.handleWebhook("payload", "sig");

            verify(paymentService, times(1)).record(eq(123L), eq(new BigDecimal("50.00")), eq(LocalDate.now()), eq("stripe:pi_999999"));
        }
    }

    @Test
    void createPaymentIntent_wrongAccount_throwsForbidden() {
        Invoice invoice = new Invoice();
        invoice.setId(10L);
        invoice.setAccountId(99L);
        when(invoiceRepository.findById(10L)).thenReturn(Optional.of(invoice));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                stripePaymentService.createPaymentIntent(10L, 50L, new BigDecimal("100.00")));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void createPaymentIntent_alreadyPaid_throwsBadRequest() {
        Invoice invoice = new Invoice();
        invoice.setId(10L);
        invoice.setAccountId(50L);
        invoice.setStatus(InvoiceStatus.paid);
        when(invoiceRepository.findById(10L)).thenReturn(Optional.of(invoice));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                stripePaymentService.createPaymentIntent(10L, 50L, new BigDecimal("100.00")));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void createPaymentIntent_amountExceedsRemaining_throwsBadRequest() {
        Invoice invoice = new Invoice();
        invoice.setId(10L);
        invoice.setAccountId(50L);
        invoice.setStatus(InvoiceStatus.open);
        Account account = new Account();
        account.setId(50L);

        when(invoiceRepository.findById(10L)).thenReturn(Optional.of(invoice));
        when(accountRepository.findById(50L)).thenReturn(Optional.of(account));
        when(invoiceService.getRemainingBalance(invoice)).thenReturn(new BigDecimal("50.00"));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                stripePaymentService.createPaymentIntent(10L, 50L, new BigDecimal("75.00")));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void createPaymentIntent_validCustomAmount_createsIntent() {
        Invoice invoice = new Invoice();
        invoice.setId(10L);
        invoice.setAccountId(50L);
        invoice.setStatus(InvoiceStatus.open);
        Account account = new Account();
        account.setId(50L);

        when(invoiceRepository.findById(10L)).thenReturn(Optional.of(invoice));
        when(accountRepository.findById(50L)).thenReturn(Optional.of(account));
        when(invoiceService.getRemainingBalance(invoice)).thenReturn(new BigDecimal("100.00"));

        PaymentIntent mockedIntent = mock(PaymentIntent.class);
        when(mockedIntent.getClientSecret()).thenReturn("pi_secret_xyz");
        when(mockedIntent.getId()).thenReturn("pi_123");

        try (MockedStatic<PaymentIntent> mockedPaymentIntent = mockStatic(PaymentIntent.class)) {
            mockedPaymentIntent.when(() -> PaymentIntent.create(any(com.stripe.param.PaymentIntentCreateParams.class)))
                    .thenReturn(mockedIntent);

            Map<String, Object> res = stripePaymentService.createPaymentIntent(10L, 50L, new BigDecimal("40.00"));

            assertEquals("pi_secret_xyz", res.get("clientSecret"));
            assertEquals("pi_123", res.get("paymentIntentId"));
            assertEquals(new BigDecimal("40.00"), res.get("amount"));
            assertEquals(10L, res.get("invoiceId"));
        }
    }
}
