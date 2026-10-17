import { api } from './client';

// ---- Auth (P0.1) ----
export const login = (email, password) => api.post('/auth/login', { email, password });
export const signup = (payload) => api.post('/auth/signup', payload);
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });

// ---- Accounts / worklist / detail / aging (P0.2, P0.3) ----
export const createAccount = (payload) => api.post('/api/accounts', payload);
export const getWorklist = (params = {}) => api.get('/api/accounts', { params });
export const getAccountDetail = (id) => api.get(`/api/accounts/${id}`);
export const getAccountAging = (id) => api.get(`/api/accounts/${id}/aging`);
export const getScoreBreakdown = (id) => api.get(`/api/accounts/${id}/score-breakdown`);
export const requestOutreach = (id) => api.post(`/api/accounts/${id}/request-outreach`);

// ---- Invoices (P0.2) ----
export const createInvoice = (accountId, payload) =>
  api.post(`/api/accounts/${accountId}/invoices`, payload);

// ---- Payments (P0.2) ----
export const recordPayment = (invoiceId, payload) =>
  api.post(`/api/invoices/${invoiceId}/payments`, payload);
export const listPayments = (invoiceId) => api.get(`/api/invoices/${invoiceId}/payments`);

// ---- Communications (P0.4) ----
export const getCommunications = (accountId) => api.get(`/api/accounts/${accountId}/communications`);
export const logCommunication = (accountId, payload) =>
  api.post(`/api/accounts/${accountId}/communications`, payload);
export const sendReminder = (accountId) => api.post(`/api/accounts/${accountId}/send-reminder`);

// ---- PTPs (P0.4) ----
export const createPtp = (accountId, payload) => api.post(`/api/accounts/${accountId}/ptp`, payload);
export const getPtps = (accountId) => api.get(`/api/accounts/${accountId}/ptp`);
export const getOrgPtps = () => api.get('/api/ptp');
export const updatePtpStatus = (id, status) => api.patch(`/api/ptp/${id}`, { status });
export const runPtpSweep = () => api.post('/api/admin/run-ptp-sweep');

// ---- Disputes (P0.4, P1 #36) ----
export const createDispute = (accountId, payload) =>
  api.post(`/api/accounts/${accountId}/disputes`, payload);
export const getDisputes = (accountId) => api.get(`/api/accounts/${accountId}/disputes`);
export const getOrgDisputes = () => api.get('/api/disputes');
export const updateDispute = (disputeId, payload) => api.patch(`/api/disputes/${disputeId}`, payload);

// ---- Reason codes (P0.5) ----
export const getReasonCodes = () => api.get('/api/reason-codes');

// ---- Org / manager (P0.7) ----
export const getDashboard = (orgId) => api.get(`/api/orgs/${orgId}/dashboard`);
export const getPriorityFactors = (orgId) => api.get(`/api/orgs/${orgId}/priority-factors`);
export const updatePriorityFactors = (orgId, factors) =>
  api.patch(`/api/orgs/${orgId}/priority-factors`, { factors });

// ---- Customer portal (P0.8 + enhancements) ----
export const getCustomerBalance = () => api.get('/api/customer/balance');
export const submitCustomerDispute = (payload) => api.post('/api/customer/disputes', payload);
export const getCustomerDisputes = () => api.get('/api/customer/disputes');
export const submitCustomerPtp = (payload) => api.post('/api/customer/ptp', payload);
export const getCustomerPtps = () => api.get('/api/customer/ptp');
export const getCustomerReasonCodes = () => api.get('/api/customer/reason-codes');
export const payInvoiceDemo = (invoiceId, amount) =>
  api.post('/api/customer/pay-demo', { invoiceId, ...(amount ? { amount: Number(amount) } : {}) });
export const payBatchInvoices = (invoiceIds) =>
  api.post('/api/customer/pay-batch', { invoiceIds });

// ================= P1 additions =================

// ---- Score history (P1 #37) ----
export const getScoreHistory = (id) => api.get(`/api/accounts/${id}/score-history`);

// ---- Handoff summary (P1 #33) ----
export const getHandoffSummary = (id) => api.get(`/api/accounts/${id}/handoff-summary`);

// ---- Suggested talking points (P1 #31) ----
export const getTalkingPoints = (id) => api.get(`/api/accounts/${id}/talking-points`);

// ---- Bulk actions (P1 #39, #48) ----
export const bulkReminder = (accountIds) => api.post('/api/accounts/bulk-reminder', { accountIds });
export const bulkReassign = (accountIds, relationshipOwnerId) =>
  api.post('/api/accounts/bulk-reassign', { accountIds, relationshipOwnerId });
export const bulkOwnershipMode = (accountIds, ownershipMode, relationshipOwnerId) =>
  api.patch('/api/accounts/bulk-ownership-mode', { accountIds, ownershipMode, relationshipOwnerId });
export const assignCollector = (id, collectorId) =>
  api.patch(`/api/accounts/${id}/assign-collector`, { collectorId });
export const bulkAssignCollector = (accountIds, collectorId) =>
  api.post('/api/accounts/bulk-assign-collector', { accountIds, collectorId });
export const autoDistributeAccounts = (accountIds, collectorIds, strategy) =>
  api.post('/api/accounts/auto-distribute', { accountIds, collectorIds, strategy });

// ---- Credit hold / write-off workflow (P1 #45) ----
export const setCreditHold = (id, creditHold, reason) =>
  api.patch(`/api/accounts/${id}/credit-hold`, { creditHold, reason });
export const writeOffInvoice = (accountId, invoiceId) =>
  api.patch(`/api/accounts/${accountId}/invoices/${invoiceId}/write-off`);

// ---- CSV import (P1 #43) ----
export const importAccountsCsv = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/accounts/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ---- Outcome analytics (P1 #27) ----
export const getOutcomeStats = (orgId) => api.get(`/api/orgs/${orgId}/outcome-stats`);

// ---- Feedback analysis / weight suggestions (P1 #28, #29) ----
export const getWeightSuggestions = (orgId) => api.get(`/api/orgs/${orgId}/weight-suggestions`);

// ---- Co-actor task inbox (P1 #30) ----
export const getCoActorTasks = (assignedTo) =>
  api.get('/api/co-actor-tasks', { params: assignedTo ? { assignedTo } : {} });
export const getCoActorTask = (id) => api.get(`/api/co-actor-tasks/${id}`);
export const updateCoActorTask = (id, payload) => api.patch(`/api/co-actor-tasks/${id}`, payload);
export const reassignCoActorTask = (id, assignedTo) =>
  api.patch(`/api/co-actor-tasks/${id}/reassign`, { assignedTo });

// ---- SLA escalation engine (P1 #32, #34) ----
export const getEscalationRules = (orgId) => api.get(`/api/orgs/${orgId}/escalation-rules`);
export const createEscalationRule = (orgId, payload) => api.post(`/api/orgs/${orgId}/escalation-rules`, payload);
export const updateEscalationRule = (orgId, ruleId, payload) => api.patch(`/api/orgs/${orgId}/escalation-rules/${ruleId}`, payload);
export const deleteEscalationRule = (orgId, ruleId) => api.delete(`/api/orgs/${orgId}/escalation-rules/${ruleId}`);
export const getEscalationEvents = (orgId) => api.get(`/api/orgs/${orgId}/escalation-events`);
export const runEscalationCheck = () => api.post('/api/admin/run-escalation-check');

// ---- PTP due-date alerts (P1 #35) ----
export const getPtpAlerts = (orgId) => api.get(`/api/orgs/${orgId}/ptp-alerts`);

// ---- Team and personal performance (P1 #40) ----
export const getTeamStats = (orgId) => api.get(`/api/orgs/${orgId}/team-stats`);
export const getMyStats = () => api.get('/api/users/me/stats');

// ---- Pay-now / payment history / invoice PDF (P1 #41, #42, #49) ----
export const payInvoice = (invoiceId, amount) =>
  api.post('/api/customer/pay', { invoiceId, ...(amount ? { amount: Number(amount) } : {}) });
export const getCustomerPayments = () => api.get('/api/customer/payments');
export const downloadInvoicePdf = (invoiceId) =>
  api.get(`/api/customer/invoices/${invoiceId}/pdf`, { responseType: 'blob' });

// ---- Org-wide reporting: DSO, CEI, aging trend (P1 #44) ----
export const getOrgReport = (orgId, periodDays) =>
  api.get(`/api/orgs/${orgId}/reports`, { params: periodDays ? { periodDays } : {} });

// ---- Reason code management (P1 #46) ----
export const createReasonCode = (payload) => api.post('/api/reason-codes', payload);
export const updateReasonCode = (id, payload) => api.patch(`/api/reason-codes/${id}`, payload);
export const deleteReasonCode = (id) => api.delete(`/api/reason-codes/${id}`);

// ---- User management (P1 #47) ----
export const listUsers = () => api.get('/api/users');
export const inviteUser = (payload) => api.post('/api/users/invite', payload);
export const updateUserRole = (id, role) => api.patch(`/api/users/${id}/role`, { role });
export const setUserActive = (id, active) => api.patch(`/api/users/${id}/active`, { active });

// ---- Platform admin (vendor-side org provisioning) ----
export const listPlatformOrgs = () => api.get('/api/platform/orgs');
export const getPlatformOrg = (id) => api.get(`/api/platform/orgs/${id}`);
export const createPlatformOrg = (name) => api.post('/api/platform/orgs', { name });
export const updatePlatformOrg = (id, payload) => api.patch(`/api/platform/orgs/${id}`, payload);
export const deactivatePlatformOrg = (id) => api.patch(`/api/platform/orgs/${id}/deactivate`);
export const reactivatePlatformOrg = (id) => api.patch(`/api/platform/orgs/${id}/reactivate`);
export const seedPlatformManager = (orgId, payload) =>
  api.post(`/api/platform/orgs/${orgId}/managers`, payload);
export const getPlatformOrgUsers = (id) => api.get(`/api/platform/orgs/${id}/users`);
export const getPlatformOrgSummary = (id) => api.get(`/api/platform/orgs/${id}/summary`);
export const getPlatformOrgActivity = (id) => api.get(`/api/platform/orgs/${id}/activity`);
export const getPlatformSummary = () => api.get('/api/platform/summary');
export const getPlatformGlobalActivity = () => api.get('/api/platform/activity');
export const resetPlatformUserPassword = (orgId, userId) =>
  api.post(`/api/platform/orgs/${orgId}/users/${userId}/reset-password`);
export const listPlatformAdmins = () => api.get('/api/platform/admins');
export const createPlatformAdmin = (payload) => api.post('/api/platform/admins', payload);
export const setPlatformAdminActive = (userId, active) =>
  api.patch(`/api/platform/admins/${userId}/active`, { active });
export const resetPlatformAdminPassword = (userId) =>
  api.post(`/api/platform/admins/${userId}/reset-password`);

// ---- Notifications (P1 #51) ----
export const getNotifications = (unreadOnly) =>
  api.get('/api/notifications', { params: unreadOnly ? { unread: true } : {} });
export const markNotificationRead = (id) => api.patch(`/api/notifications/${id}/read`);

// ---- Emails (Outbox / Transmissions / Compose) ----
export const listEmails = (params = {}) => api.get('/api/emails', { params });
export const listPlatformEmails = () => api.get('/api/platform/emails');
export const getEmailById = (id) => api.get(`/api/emails/${id}`);
export const sendCustomEmail = (payload) => api.post('/api/emails/send', payload);

// ---- Self-service profile ----
export const updateMyProfile = (payload) => api.patch('/api/users/me', payload);
export const changeMyPassword = (payload) => api.post('/api/users/me/change-password', payload);
