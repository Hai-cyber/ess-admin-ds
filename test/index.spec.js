import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import worker from '../src';
import { initializeDatabase } from '../src/db/init';

beforeEach(() => {
	env.TWILIO_ACCOUNT_SID = 'AC_TEST_ACCOUNT_SID';
	env.TWILIO_AUTH_TOKEN = 'test-auth-token';
});

afterEach(() => {
	vi.restoreAllMocks();
});

async function createStripeSignatureHeader(secret, payload) {
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
	const signature = Array.from(new Uint8Array(signatureBytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
	return `t=${timestamp},v1=${signature}`;
}

describe('ESSKULTUR worker', () => {
	it('returns a JSON 404 for unknown unit routes', async () => {
		const request = new Request('http://example.com/not-found');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ ok: false, error: 'Not found' });
	});

	it('returns health payload (unit style)', async () => {
		const request = new Request('http://example.com/api/health');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.service).toBe('ess-admin-ds');
		expect(typeof body.time).toBe('string');
	});

	it('serves app homepage HTML (integration style)', async () => {
		const response = await SELF.fetch('http://example.com/');
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type') || '').toContain('text/html');
		expect(html).toContain('<title>Ess Admin DS</title>');
	});

	it('blocks reserved system subdomains during availability checks', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://localhost/api/platform/signup/check-subdomain?slug=admin');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(body.available).toBe(false);
		expect(body.decision).toBe('block');
		expect(Array.isArray(body.reason_codes)).toBe(true);
		expect(body.reason_codes).toContain('internal_system_block');
	});

	it('rejects signup when subdomain is blocked by platform policy', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://localhost/api/platform/signup', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				restaurant_name: 'Blocked Slug Diner',
				owner_email: 'blocked-slug@example.com',
				subdomain: 'admin',
				plan: 'core',
				admin_pin: '1234',
				admin_name: 'Owner'
			})
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(body.code).toBe('subdomain_blocked');

		const company = await env.DB.prepare(
			`SELECT id FROM companies WHERE lower(email) = lower(?) LIMIT 1`
		).bind('blocked-slug@example.com').first();
		expect(company).toBeNull();
	});

	it('saves SaaS admin payment method toggles and exposes them in platform plans', async () => {
		await initializeDatabase(env.DB);

		const saveRequest = new Request('http://localhost/api/platform/admin/config', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '1234',
				values: {
					platform_payment_method_bankcard: 'enabled',
					platform_payment_method_paypal: 'disabled',
					platform_payment_method_cash: 'enabled',
					platform_payment_method_pickup_at_store: 'disabled'
				}
			})
		});

		let ctx = createExecutionContext();
		let response = await worker.fetch(saveRequest, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);

		const plansRequest = new Request('http://localhost/api/platform/plans');
		ctx = createExecutionContext();
		response = await worker.fetch(plansRequest, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(Array.isArray(body.paymentMethods?.enabled)).toBe(true);
		expect(body.paymentMethods.enabled).toContain('bankcard');
		expect(body.paymentMethods.enabled).toContain('cash');
		expect(body.paymentMethods.enabled).not.toContain('paypal');
		expect(body.paymentMethods.enabled).not.toContain('pickup_at_store');
	});

	it('rejects signup when selected payment method is disabled by SaaS admin', async () => {
		await initializeDatabase(env.DB);

		await env.DB.prepare(`
			INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(company_id, key) DO UPDATE SET
				value = excluded.value,
				description = excluded.description,
				updated_at = excluded.updated_at,
				updated_by = excluded.updated_by
		`).bind(1, 'platform_payment_method_paypal', 'disabled', 'test', new Date().toISOString(), 'test').run();

		const request = new Request('http://localhost/api/platform/signup', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				restaurant_name: 'Disabled Payment Diner',
				owner_email: 'disabled-payment@example.com',
				subdomain: 'disabled-payment-diner',
				plan: 'core',
				admin_pin: '1234',
				admin_name: 'Owner',
				demo_payment_method: 'paypal'
			})
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(String(body.code || '')).toBe('payment_method_disabled');
		expect(Array.isArray(body.enabled_payment_methods)).toBe(true);
		expect(body.enabled_payment_methods).not.toContain('paypal');
	});

	it('returns tenant admin payment method policy in platform config payload', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://localhost/api/admin/platform-config?company_id=1&pin=1234');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(Array.isArray(body.paymentMethodPolicy?.enabled)).toBe(true);
		expect(typeof body.paymentMethodPolicy?.toggles).toBe('object');
	});

	it('creates a tenant custom-domain upgrade request and returns it in platform config', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://localhost/api/admin/domain-upgrade/request?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '1234',
				requestedDomain: 'www.restaurant-one.de',
				registrationMode: 'byod',
				requestNote: 'Need branded host for launch.'
			})
		});
		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(String(body.request?.request_status || '')).toBe('requested');

		const configRequest = new Request('http://localhost/api/admin/platform-config?company_id=1&pin=1234');
		ctx = createExecutionContext();
		response = await worker.fetch(configRequest, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const configBody = await response.json();
		expect(configBody.success).toBe(true);
		expect(String(configBody.customDomainRequest?.requested_domain || '')).toBe('www.restaurant-one.de');
		expect(Array.isArray(configBody.customDomainRequestHistory)).toBe(true);
		expect(configBody.customDomainRequestHistory.length).toBeGreaterThan(0);
	});

	it('allows operator approval, verification, and activation for a custom-domain request', async () => {
		await initializeDatabase(env.DB);
		env.CUSTOM_DOMAIN_DNS_VERIFY_MODE = 'mock';
		env.CUSTOM_DOMAIN_ACTIVATION_HEALTHCHECK_MODE = 'mock';

		let request = new Request('http://localhost/api/admin/domain-upgrade/request?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '1234',
				requestedDomain: 'www.restaurant-activation.de',
				registrationMode: 'byod',
				requestNote: 'Commerce upgrade requested.'
			})
		});
		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const createBody = await response.json();
		const domainRequestId = String(createBody.request?.id || '');
		expect(domainRequestId).not.toBe('');

		for (const action of ['approve', 'verify', 'activate']) {
			if (action === 'verify') {
				request = new Request('http://localhost/api/admin/domain-upgrade/mark-dns-ready?company_id=1', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ pin: '1234' })
				});
				ctx = createExecutionContext();
				response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);
				expect(response.status).toBe(200);
			}

			request = new Request(`http://localhost/api/platform/admin/domain-requests/${encodeURIComponent(domainRequestId)}/${action}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ pin: '1234', operatorNote: `Operator ${action}` })
			});
			ctx = createExecutionContext();
			response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
		}

		const activeRequest = await env.DB.prepare(
			`SELECT request_status, activated_at, last_health_check_status, last_health_check_note FROM custom_domain_requests WHERE id = ? LIMIT 1`
		).bind(domainRequestId).first();
		const domainEvents = await env.DB.prepare(
			`SELECT event_type FROM custom_domain_request_events WHERE request_id = ? ORDER BY created_at DESC`
		).bind(domainRequestId).all();
		const customDomainSetting = await env.DB.prepare(
			`SELECT value FROM settings WHERE company_id = 1 AND key = 'custom_domain' LIMIT 1`
		).first();
		expect(String(activeRequest?.request_status || '')).toBe('active');
		expect(String(activeRequest?.activated_at || '')).not.toBe('');
		expect(String(activeRequest?.last_health_check_status || '')).toBe('healthy');
		expect(String(activeRequest?.last_health_check_note || '')).toContain('website payload');
		expect(String(customDomainSetting?.value || '')).toBe('www.restaurant-activation.de');
		expect((domainEvents.results || []).map((row) => String(row.event_type || ''))).toEqual(expect.arrayContaining([
			'request_created',
			'request_approved',
			'dns_marked_ready',
			'dns_verified',
			'domain_activated',
			'activation_health_checked'
		]));

		request = new Request('http://localhost/api/platform/admin/dashboard?pin=1234');
		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const dashboardBody = await response.json();
		expect(dashboardBody.ok).toBe(true);
		expect(Array.isArray(dashboardBody.customDomainRequests)).toBe(true);
		expect(Array.isArray(dashboardBody.customDomainRequestEvents)).toBe(true);
		expect(dashboardBody.customDomainRequests.some((row) => String(row.id || '') === domainRequestId)).toBe(true);
	});

	it('resolves tenant website payload by custom domain host after activation', async () => {
		await initializeDatabase(env.DB);

		await env.DB.prepare(
			`INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
			 VALUES (?, 'custom_domain', ?, 'Custom domain mapped for the tenant website', ?, ?)
			 ON CONFLICT(company_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
		).bind(1, 'www.tenant-custom-host.de', new Date().toISOString(), 'test').run();

		const request = new Request('https://www.tenant-custom-host.de/api/website/payload');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(Number(body.companyId || 0)).toBe(1);
	});

	it('stores renewal tracking fields for managed registration requests', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://localhost/api/admin/domain-upgrade/request?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '1234',
				requestedDomain: 'www.restaurant-renewal.de',
				registrationMode: 'managed_registration',
				requestNote: 'Bundle this into platform billing.'
			})
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(String(body.request?.renewal_mode || '')).toBe('platform_managed');
		expect(String(body.request?.renewal_status || '')).toBe('managed_active');
		expect(String(body.request?.renewal_due_at || '')).not.toBe('');
		expect(Number(body.request?.auto_renew_enabled || 0)).toBe(1);
	});

	it('runs managed domain renewal reminders from the platform admin route', async () => {
		await initializeDatabase(env.DB);

		let request = new Request('http://localhost/api/admin/domain-upgrade/request?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '1234',
				requestedDomain: 'www.renewal-reminder.de',
				registrationMode: 'managed_registration',
				requestNote: 'Run renewal reminder test.'
			})
		});
		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const createBody = await response.json();
		const requestId = String(createBody.request?.id || '');
		expect(requestId).not.toBe('');

		await env.DB.prepare(
			`UPDATE custom_domain_requests SET request_status = 'active', renewal_due_at = ?, renewal_mode = 'platform_managed', renewal_status = 'managed_active' WHERE id = ?`
		).bind(new Date(Date.now() + 30 * 86400000).toISOString(), requestId).run();

		request = new Request('http://localhost/api/platform/admin/domain-renewals/run-reminders', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234' })
		});
		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(Number(body.summary?.reminded || 0)).toBeGreaterThanOrEqual(1);

		const reminderEvent = await env.DB.prepare(
			`SELECT event_type FROM custom_domain_request_events WHERE request_id = ? AND event_type = 'renewal_reminder_30d' LIMIT 1`
		).bind(requestId).first();
		expect(String(reminderEvent?.event_type || '')).toBe('renewal_reminder_30d');
	});

	it('supports renewal reminder preview and forced overdue escalation for operators', async () => {
		await initializeDatabase(env.DB);

		let request = new Request('http://localhost/api/admin/domain-upgrade/request?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '1234',
				requestedDomain: 'www.preview-overdue.de',
				registrationMode: 'managed_registration',
				requestNote: 'Preview and escalation test.'
			})
		});
		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const createBody = await response.json();
		const requestId = String(createBody.request?.id || '');

		await env.DB.prepare(
			`UPDATE custom_domain_requests SET request_status = 'active', renewal_mode = 'platform_managed', renewal_due_at = ? WHERE id = ?`
		).bind(new Date(Date.now() + 14 * 86400000).toISOString(), requestId).run();

		request = new Request(`http://localhost/api/platform/admin/domain-renewals/${encodeURIComponent(requestId)}/preview`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234' })
		});
		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		let body = await response.json();
		expect(body.ok).toBe(true);
		expect(String(body.preview?.text || '')).toContain('due in 14 day');

		request = new Request(`http://localhost/api/platform/admin/domain-renewals/${encodeURIComponent(requestId)}/force-overdue`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234', note: 'Manual escalation' })
		});
		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		body = await response.json();
		expect(body.ok).toBe(true);
		expect(String(body.request?.renewalStatus || body.request?.renewal_status || '')).toBe('renewal_overdue');
	});

	it('sends operator digest channels when renewal reminders are generated', async () => {
		await initializeDatabase(env.DB);

		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = String(input || '');
			if (url.startsWith('https://api.telegram.org/') || url === 'https://api.mailchannels.net/tx/v1/send') {
				return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
		env.TELEGRAM_REVIEW_CHAT_ID = '123456';
		env.OPERATOR_DIGEST_EMAIL_TO = 'ops@example.com';
		env.OPERATOR_DIGEST_EMAIL_FROM = 'noreply@gooddining.app';

		let request = new Request('http://localhost/api/admin/domain-upgrade/request?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '1234',
				requestedDomain: 'www.digest-test.de',
				registrationMode: 'managed_registration',
				requestNote: 'Digest test.'
			})
		});
		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const createBody = await response.json();
		const requestId = String(createBody.request?.id || '');
		await env.DB.prepare(
			`UPDATE custom_domain_requests SET request_status = 'active', renewal_mode = 'platform_managed', renewal_due_at = ? WHERE id = ?`
		).bind(new Date(Date.now() + 7 * 86400000).toISOString(), requestId).run();

		request = new Request('http://localhost/api/platform/admin/domain-renewals/run-reminders', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234', sendDigest: true })
		});
		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(Array.isArray(body.summary?.digest?.channels)).toBe(true);
		expect(body.summary.digest.channels.some((item) => item.channel === 'telegram' && item.ok)).toBe(true);
		expect(body.summary.digest.channels.some((item) => item.channel === 'email' && item.ok)).toBe(true);
		expect(fetchSpy).toHaveBeenCalled();
	});

	it('rejects tenant admin subdomain updates that hit blocked policy terms', async () => {
		await initializeDatabase(env.DB);

		const baseline = await env.DB.prepare(
			`SELECT name, email, phone, timezone FROM companies WHERE id = ? LIMIT 1`
		).bind(1).first();

		const request = new Request('http://localhost/api/admin/platform-config?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '1234',
				company: {
					name: baseline?.name || '',
					email: baseline?.email || '',
					phone: baseline?.phone || '',
					subdomain: 'support',
					timezone: baseline?.timezone || 'UTC'
				},
				operationalSettings: {},
				modules: {}
			})
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.success).toBe(false);
		expect(Array.isArray(body.reason_codes)).toBe(true);
		expect(body.reason_codes).toContain('internal_system_block');
	});

	it('creates a website publish review and notifies Telegram for suspicious content', async () => {
		await initializeDatabase(env.DB);
		env.TELEGRAM_BOT_TOKEN = 'telegram-test-token';
		env.TELEGRAM_REVIEW_CHAT_ID = '-1001234567890';

		const now = new Date().toISOString();
		await env.DB.prepare(`
			INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(company_id, key) DO UPDATE SET
				value = excluded.value,
				description = excluded.description,
				updated_at = excluded.updated_at,
				updated_by = excluded.updated_by
		`).bind(
			1,
			'site_content_json',
			JSON.stringify({ hero_note: 'Join our crypto club on https://t.me/fakepromo right now.' }),
			'test suspicious content',
			now,
			'test'
		).run();

		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = typeof input === 'string' ? input : input.url;
			if (url.includes('api.telegram.org/')) {
				return new Response(JSON.stringify({ ok: true, result: { message_id: 123 } }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		const request = new Request('http://localhost/api/admin/website/publish?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234' })
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.decision).toBe('review');
		expect(body.reason_codes).toContain('suspicious_external_link');
		expect(fetchSpy).toHaveBeenCalled();
		const telegramPayload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body || '{}'));
		expect(String(telegramPayload.text || '')).toContain('/platform/admin.html?review=');
		expect(telegramPayload.reply_markup?.inline_keyboard?.length || 0).toBeGreaterThan(0);

		const review = await env.DB.prepare(
			`SELECT decision, review_status, reason_codes_json FROM publish_reviews WHERE id = ? LIMIT 1`
		).bind(body.review_id).first();

		expect(String(review?.decision || '')).toBe('review');
		expect(String(review?.review_status || '')).toBe('pending');
		expect(String(review?.reason_codes_json || '')).toContain('suspicious_external_link');
	});

	it('rejects a new publish submission while another release is pending review', async () => {
		await initializeDatabase(env.DB);

		const now = new Date().toISOString();
		await env.DB.prepare(`
			INSERT INTO publish_reviews (
				id, company_id, host, subdomain, decision, review_status, risk_score,
				reason_codes_json, evidence_json, payload_snapshot_json, reviewer_type, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', ?, ?)
		`).bind(
			'review_pending_1',
			1,
			'restaurant1.gooddining.app',
			'restaurant1',
			'review',
			'pending',
			25,
			JSON.stringify(['manual_review_required']),
			'{}',
			JSON.stringify({ company: { name: 'Pending Review Bistro' } }),
			now,
			now
		).run();

		await env.DB.prepare(`
			INSERT INTO website_releases (
				id, company_id, review_id, release_status, publish_target, preview_url, published_url,
				payload_snapshot_json, reason_codes_json, release_note, reviewer_type, reviewer_id,
				published_at, suspended_at, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			'pending_release_1',
			1,
			'review_pending_1',
			'pending_review',
			'managed_subdomain',
			'http://localhost/website-master/index.html?company_id=1',
			'',
			JSON.stringify({ company: { name: 'Pending Review Bistro' } }),
			JSON.stringify(['manual_review_required']),
			'Already waiting for operator review',
			'system',
			'publish-gate',
			null,
			null,
			now,
			now
		).run();

		const request = new Request('http://localhost/api/admin/website/publish?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234', reviewNote: 'Try to resubmit while pending.' })
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(String(body.code || '')).toBe('release_pending_review');
	});

	it('submits a clean website release for publish approval without making it live immediately', async () => {
		await initializeDatabase(env.DB);

		const now = new Date().toISOString();
		await env.DB.prepare(`
			INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(company_id, key) DO UPDATE SET
				value = excluded.value,
				description = excluded.description,
				updated_at = excluded.updated_at,
				updated_by = excluded.updated_by
		`).bind(
			1,
			'site_content_json',
			JSON.stringify({ hero_note: 'Seasonal tasting menu and neighborhood dining.' }),
			'test clean content',
			now,
			'test'
		).run();

		const beforeCompany = await env.DB.prepare(
			`SELECT website_status FROM companies WHERE id = ? LIMIT 1`
		).bind(1).first();

		const request = new Request('http://localhost/api/admin/website/publish?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234', reviewNote: 'Ready for release.' })
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(String(body.action || '')).toBe('approved_for_publish');
		expect(String(body.release_status || '')).toBe('approved');
		expect(String(body.review_status || '')).toBe('approved');
		expect(String(body.published_url || '')).toBe('');

		const afterCompany = await env.DB.prepare(
			`SELECT website_status FROM companies WHERE id = ? LIMIT 1`
		).bind(1).first();
		expect(String(afterCompany?.website_status || '')).toBe(String(beforeCompany?.website_status || 'draft'));

		const latestRelease = await env.DB.prepare(
			`SELECT release_status FROM website_releases WHERE company_id = ? ORDER BY created_at DESC LIMIT 1`
		).bind(1).first();
		expect(String(latestRelease?.release_status || '')).toBe('approved');
	});

	it('publishes the latest approved release through the dedicated tenant publish endpoint', async () => {
		await initializeDatabase(env.DB);

		const now = new Date().toISOString();
		await env.DB.prepare(`
			INSERT INTO publish_reviews (
				id, company_id, host, subdomain, decision, review_status, risk_score,
				reason_codes_json, evidence_json, payload_snapshot_json, reviewer_type, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', ?, ?)
		`).bind(
			'review_approved_1',
			1,
			'restaurant1.gooddining.app',
			'restaurant1',
			'allow',
			'approved',
			0,
			JSON.stringify([]),
			'{}',
			JSON.stringify({ company: { name: 'Approved Release Bistro' } }),
			now,
			now
		).run();

		await env.DB.prepare(`
			INSERT INTO website_releases (
				id, company_id, review_id, release_status, publish_target, preview_url, published_url,
				payload_snapshot_json, reason_codes_json, release_note, reviewer_type, reviewer_id,
				published_at, suspended_at, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			'approved_release_1',
			1,
			'review_approved_1',
			'approved',
			'managed_subdomain',
			'http://localhost/website-master/index.html?company_id=1',
			'',
			JSON.stringify({ company: { name: 'Approved Release Bistro' } }),
			JSON.stringify([]),
			'Approved and waiting to go live',
			'system',
			'publish-gate',
			null,
			null,
			now,
			now
		).run();

		const request = new Request('http://localhost/api/admin/website/publish-approved?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234', releaseNote: 'Go live now.' })
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(String(body.action || '')).toBe('publish_approved_release');
		expect(String(body.release_status || '')).toBe('published');
		expect(String(body.published_url || '')).toContain('restaurant1');

		const company = await env.DB.prepare(
			`SELECT website_status FROM companies WHERE id = ? LIMIT 1`
		).bind(1).first();
		expect(String(company?.website_status || '')).toBe('published');
	});

	it('allows operator to approve a pending publish review', async () => {
		await initializeDatabase(env.DB);
		env.TELEGRAM_BOT_TOKEN = 'telegram-test-token';
		env.TELEGRAM_REVIEW_CHAT_ID = '-1001234567890';

		const reviewId = crypto.randomUUID();
		const now = new Date().toISOString();
		await env.DB.prepare(`
			INSERT INTO publish_reviews (
				id, company_id, host, subdomain, decision, review_status, risk_score,
				reason_codes_json, evidence_json, payload_snapshot_json, reviewer_type, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', ?, ?)
		`).bind(
			reviewId,
			2,
			'restaurant2.gooddining.app',
			'restaurant2',
			'review',
			'pending',
			35,
			JSON.stringify(['suspicious_external_link']),
			'{}',
			'{}',
			now,
			now
		).run();

		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = typeof input === 'string' ? input : input.url;
			if (url.includes('api.telegram.org/')) {
				return new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}
			return new Response('Unhandled mock URL', { status: 500 });
		});

		const request = new Request(`http://localhost/api/platform/moderation/review/${reviewId}/approve`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234', reviewNote: 'Looks like a valid restaurant website.' })
		});

		const beforeCompany = await env.DB.prepare(
			`SELECT website_status, trust_state FROM companies WHERE id = ? LIMIT 1`
		).bind(2).first();

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.action).toBe('approve');

		const review = await env.DB.prepare(
			`SELECT decision, review_status, reviewer_type, review_note FROM publish_reviews WHERE id = ? LIMIT 1`
		).bind(reviewId).first();
		expect(String(review?.decision || '')).toBe('allow');
		expect(String(review?.review_status || '')).toBe('approved');
		expect(String(review?.reviewer_type || '')).toBe('operator');
		expect(String(review?.review_note || '')).toContain('valid restaurant');

		const company = await env.DB.prepare(
			`SELECT website_status, trust_state FROM companies WHERE id = ? LIMIT 1`
		).bind(2).first();
		expect(String(company?.website_status || '')).toBe(String(beforeCompany?.website_status || 'draft'));
		expect(String(company?.trust_state || '')).toBe('trusted');

		const releaseStates = await env.DB.prepare(
			`SELECT release_status FROM website_releases WHERE review_id = ? ORDER BY created_at ASC`
		).bind(reviewId).all();
		expect(Array.isArray(releaseStates?.results)).toBe(true);
		expect(releaseStates.results.map((row) => String(row.release_status || ''))).toContain('approved');
		expect(releaseStates.results.map((row) => String(row.release_status || ''))).not.toContain('published');
		expect(fetchSpy).toHaveBeenCalled();
	});

	it('allows operator to reject a pending publish review', async () => {
		await initializeDatabase(env.DB);

		const reviewId = crypto.randomUUID();
		const now = new Date().toISOString();
		await env.DB.prepare(`
			INSERT INTO publish_reviews (
				id, company_id, host, subdomain, decision, review_status, risk_score,
				reason_codes_json, evidence_json, payload_snapshot_json, reviewer_type, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', ?, ?)
		`).bind(
			reviewId,
			2,
			'restaurant2.gooddining.app',
			'restaurant2',
			'review',
			'pending',
			35,
			JSON.stringify(['suspicious_external_link']),
			'{}',
			'{}',
			now,
			now
		).run();

		const request = new Request(`http://localhost/api/platform/moderation/review/${reviewId}/reject`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234', reviewNote: 'Suspicious outbound link remains unresolved.' })
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.action).toBe('reject');

		const review = await env.DB.prepare(
			`SELECT decision, review_status, review_note FROM publish_reviews WHERE id = ? LIMIT 1`
		).bind(reviewId).first();
		expect(String(review?.decision || '')).toBe('block');
		expect(String(review?.review_status || '')).toBe('rejected');
		expect(String(review?.review_note || '')).toContain('Suspicious outbound link');

		const company = await env.DB.prepare(
			`SELECT website_status FROM companies WHERE id = ? LIMIT 1`
		).bind(2).first();
		expect(String(company?.website_status || '')).toBe('draft');
	});

	it('allows operator to suspend a tenant website', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://localhost/api/platform/tenants/2/suspend-website', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234', reason: 'phishing_review_confirmed' })
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.website_status).toBe('suspended');
		expect(body.trust_state).toBe('suspended');

		const company = await env.DB.prepare(
			`SELECT website_status, trust_state, suspended_reason FROM companies WHERE id = ? LIMIT 1`
		).bind(2).first();
		expect(String(company?.website_status || '')).toBe('suspended');
		expect(String(company?.trust_state || '')).toBe('suspended');
		expect(String(company?.suspended_reason || '')).toBe('phishing_review_confirmed');
	});

	it('allows operator to quarantine a subdomain', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://localhost/api/platform/subdomains/restaurant2/quarantine', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234', reason: 'brand_protection_hold' })
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.subdomain_status).toBe('quarantine');

		const reservation = await env.DB.prepare(
			`SELECT status, reason_code FROM subdomain_reservations WHERE normalized_slug = ? ORDER BY updated_at DESC LIMIT 1`
		).bind('restaurant2').first();
		expect(String(reservation?.status || '')).toBe('quarantine');
		expect(String(reservation?.reason_code || '')).toBe('brand_protection_hold');

		const company = await env.DB.prepare(
			`SELECT subdomain_status FROM companies WHERE id = ? LIMIT 1`
		).bind(2).first();
		expect(String(company?.subdomain_status || '')).toBe('quarantine');
	});

	it('blocks public website payload when tenant website is suspended on host-based resolution', async () => {
		await initializeDatabase(env.DB);

		await env.DB.prepare(`
			UPDATE companies
			SET website_status = 'suspended', trust_state = 'suspended'
			WHERE id = ?
		`).bind(2).run();

		const request = new Request('http://restaurant2.gooddining.app/api/website/payload');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(423);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(body.error).toBe('tenant_website_suspended');
	});

	it('blocks website-master public rendering when tenant subdomain is quarantined on host-based resolution', async () => {
		await initializeDatabase(env.DB);

		await env.DB.prepare(`
			UPDATE companies
			SET subdomain_status = 'quarantine'
			WHERE id = ?
		`).bind(2).run();

		const request = new Request('http://restaurant2.gooddining.app/website-master/index.html');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(423);
		const html = await response.text();
		expect(html).toContain('Website Unavailable');
	});

	it('serves the latest published release snapshot for public website payloads', async () => {
		await initializeDatabase(env.DB);
		const now = new Date().toISOString();

		await env.DB.prepare(`
			INSERT INTO website_releases (
				id, company_id, review_id, release_status, publish_target, preview_url, published_url,
				payload_snapshot_json, reason_codes_json, release_note, reviewer_type, reviewer_id,
				published_at, suspended_at, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			'release_snapshot_live',
			2,
			null,
			'published',
			'managed_subdomain',
			'http://localhost/website-master/index.html?company_id=2',
			'https://restaurant2.gooddining.app',
			JSON.stringify({ company: { name: 'Published Snapshot Bistro' }, pages: { home: { title: 'Snapshot Hero' } } }),
			JSON.stringify([]),
			'Published snapshot',
			'system',
			'publish-gate',
			now,
			null,
			now,
			now
		).run();

		const request = new Request('http://restaurant2.gooddining.app/api/website/payload');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(String(body.source?.company?.name || '')).toBe('Published Snapshot Bistro');
	});

	it('allows tenant admin to roll back to an older published release snapshot', async () => {
		await initializeDatabase(env.DB);
		const earlier = '2026-04-01T08:00:00.000Z';
		const later = '2026-04-02T08:00:00.000Z';

		for (const row of [
			{
				id: 'release_old_live',
				note: 'Old stable live',
				payload: { company: { name: 'Old Stable Live' } },
				publishedAt: earlier,
				updatedAt: earlier
			},
			{
				id: 'release_current_live',
				note: 'Current live',
				payload: { company: { name: 'Current Live' } },
				publishedAt: later,
				updatedAt: later
			}
		]) {
			await env.DB.prepare(`
				INSERT INTO website_releases (
					id, company_id, review_id, release_status, publish_target, preview_url, published_url,
					payload_snapshot_json, reason_codes_json, release_note, reviewer_type, reviewer_id,
					published_at, suspended_at, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(
				row.id,
				1,
				null,
				'published',
				'managed_subdomain',
				'http://localhost/website-master/index.html?company_id=1',
				'https://restaurant1.gooddining.app',
				JSON.stringify(row.payload),
				JSON.stringify([]),
				row.note,
				'system',
				'publish-gate',
				row.publishedAt,
				null,
				row.publishedAt,
				row.updatedAt
			).run();
		}

		let request = new Request('http://restaurant1.gooddining.app/api/website/payload');
		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		let body = await response.json();
		expect(String(body.source?.company?.name || '')).toBe('Current Live');

		const rollbackRequest = new Request('http://localhost/api/admin/website/releases/release_old_live/rollback?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234', rollbackNote: 'Restore stable version' })
		});
		ctx = createExecutionContext();
		response = await worker.fetch(rollbackRequest, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		body = await response.json();
		expect(body.ok).toBe(true);
		expect(String(body.action || '')).toBe('rollback');

		request = new Request('http://restaurant1.gooddining.app/api/website/payload');
		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		body = await response.json();
		expect(String(body.source?.company?.name || '')).toBe('Old Stable Live');

		const rolledBackRelease = await env.DB.prepare(
			`SELECT release_status FROM website_releases WHERE id = ? LIMIT 1`
		).bind('release_current_live').first();
		expect(String(rolledBackRelease?.release_status || '')).toBe('rolled_back');
	});

	it('rejects rollback for releases that were never published', async () => {
		await initializeDatabase(env.DB);
		const now = new Date().toISOString();

		await env.DB.prepare(`
			INSERT INTO website_releases (
				id, company_id, review_id, release_status, publish_target, preview_url, published_url,
				payload_snapshot_json, reason_codes_json, release_note, reviewer_type, reviewer_id,
				published_at, suspended_at, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			'rejected_release_1',
			1,
			null,
			'rejected',
			'managed_subdomain',
			'http://localhost/website-master/index.html?company_id=1',
			'',
			JSON.stringify({ company: { name: 'Rejected Draft' } }),
			JSON.stringify(['blocked_content']),
			'Rejected release snapshot',
			'system',
			'publish-gate',
			null,
			null,
			now,
			now
		).run();

		const rollbackRequest = new Request('http://localhost/api/admin/website/releases/rejected_release_1/rollback?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234', rollbackNote: 'Should fail' })
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(rollbackRequest, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(String(body.code || '')).toBe('rollback_invalid_release_state');
	});

	it('includes moderation reviews in platform admin dashboard data', async () => {
		await initializeDatabase(env.DB);

		const now = new Date().toISOString();
		await env.DB.prepare(`
			INSERT INTO publish_reviews (
				id, company_id, host, subdomain, decision, review_status, risk_score,
				reason_codes_json, evidence_json, payload_snapshot_json, reviewer_type, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', ?, ?)
		`).bind(
			crypto.randomUUID(),
			2,
			'restaurant2.gooddining.app',
			'restaurant2',
			'review',
			'pending',
			30,
			JSON.stringify(['suspicious_external_link']),
			'{}',
			'{}',
			now,
			now
		).run();

		const request = new Request('http://localhost/api/platform/admin/dashboard?pin=1234');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(Array.isArray(body.reviews)).toBe(true);
		expect(body.reviews.length).toBeGreaterThan(0);
		expect(String(body.reviews[0]?.company_name || '')).toContain('ESSKULTUR');
		expect(body.reviews.some((item) => Object.prototype.hasOwnProperty.call(item, 'release_status'))).toBe(true);
	});

	it('accepts public website contact submissions and stores them in contacts', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://localhost/api/contact/create?company_id=1', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				name: 'Contact Smoke Test',
				email: 'contact-smoke@example.com',
				phone: '+49123456789',
				subject: 'Website inquiry',
				message: 'Testing public contact route'
			})
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(typeof body.contactId).toBe('string');

		const savedContact = await env.DB.prepare(`
			SELECT company_id, name, email, phone, subject, message, status, notes
			FROM contacts
			WHERE id = ?
			LIMIT 1
		`).bind(body.contactId).first();

		expect(Number(savedContact?.company_id)).toBe(1);
		expect(String(savedContact?.name || '')).toBe('Contact Smoke Test');
		expect(String(savedContact?.email || '')).toBe('contact-smoke@example.com');
		expect(String(savedContact?.phone || '')).toBe('+49123456789');
		expect(String(savedContact?.subject || '')).toBe('Website inquiry');
		expect(String(savedContact?.message || '')).toBe('Testing public contact route');
		expect(String(savedContact?.status || '')).toBe('new');
		expect(String(savedContact?.notes || '')).toBe('website_master_public_form');
	});

	it('redirects KC form aliases to founder form in KC mode', async () => {
		const request = new Request('http://example.com/kc-form?lang=de', {
			redirect: 'manual'
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(302);
		const location = response.headers.get('location') || '';
		expect(location).toContain('/founder');
		expect(location).toContain('program=kc');
		expect(location).toContain('lang=de');
	});

	it('serves KC form UI wired to KC-specific API endpoints', async () => {
		await initializeDatabase(env.DB);

		const request = new Request(
			'http://localhost/founder?company_id=1&program=kc&website_url=https%3A%2F%2Fquan-esskultur.de&program_label=Kollegensclub&membership_type=KC&redirect=https%3A%2F%2Fquan-esskultur.de%2Fcolleague-club&terms_url=https%3A%2F%2Fquan-esskultur.de%2Ffounderpass-terms-conditions&privacy_url=https%3A%2F%2Fquan-esskultur.de%2Fprivacy'
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("'/api/kc/register'");
		expect(html).toContain("'/api/kc/verify'");
		expect(html).toContain("'/api/kc/resend-otp'");
	});

	it('accepts KC JSON registration payloads and stores KC consent', async () => {
		await initializeDatabase(env.DB);

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = typeof input === 'string' ? input : input.url;

			if (url.includes('challenges.cloudflare.com/turnstile')) {
				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			if (url.includes('api.twilio.com/')) {
				return new Response(JSON.stringify({ sid: 'SM123' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		const phone = `+49176${Date.now().toString().slice(-8)}`;
		const request = new Request('http://localhost/api/kc/register?company_id=1', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				name: 'KC Tester',
				phone,
				cf_token: 'turnstile-test-token',
				consent_sms: 'yes',
				consent_terms: 'yes',
				x_studio_kc_terms_accepted: 'yes',
				x_studio_membership_type: 'KC',
				x_studio_notes: 'KC Form Registration'
			})
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			status: 'success',
			phone
		});

		const customer = await env.DB.prepare(
			`SELECT founder_status, founder_terms_accepted, kc_terms_accepted FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();

		expect(String(customer?.founder_status || '')).toBe('pending_verification');
		expect(Number(customer?.founder_terms_accepted || 0)).toBe(0);
		expect(Number(customer?.kc_terms_accepted || 0)).toBe(1);
	});

		it('treats /api/kc/register as KC even if KC hidden fields are missing', async () => {
			await initializeDatabase(env.DB);

			vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
				const url = typeof input === 'string' ? input : input.url;

				if (url.includes('challenges.cloudflare.com/turnstile')) {
					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: { 'content-type': 'application/json' }
					});
				}

				if (url.includes('api.twilio.com/')) {
					return new Response(JSON.stringify({ sid: 'SM123' }), {
						status: 200,
						headers: { 'content-type': 'application/json' }
					});
				}

				return new Response('Unhandled mock URL', { status: 500 });
			});

			const phone = `+49179${Date.now().toString().slice(-8)}`;
			const request = new Request('http://localhost/api/kc/register?company_id=1', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					name: 'KC Path Fallback',
					phone,
					cf_token: 'turnstile-test-token',
					consent_sms: 'yes',
					consent_terms: 'yes'
				})
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			const customer = await env.DB.prepare(
				`SELECT founder_status, founder_terms_accepted, kc_terms_accepted, notes FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
			).bind(1, phone).first();

			expect(String(customer?.founder_status || '')).toBe('pending_verification');
			expect(Number(customer?.founder_terms_accepted || 0)).toBe(0);
			expect(Number(customer?.kc_terms_accepted || 0)).toBe(1);
			expect(String(customer?.notes || '')).toBe('KC Form Registration');
		});

	it('switching an existing founder contact to KC keeps only KC consent', async () => {
		await initializeDatabase(env.DB);
		const phone = `+49178${Date.now().toString().slice(-8)}`;
		const now = new Date().toISOString();

		await env.DB.prepare(`
			INSERT INTO customers (
				id, company_id, phone, name, email,
				founder_status, founder_level, founder_terms_accepted, kc_terms_accepted,
				otp_verified, sms_opt_in, opt_in_text, opt_in_timestamp,
				created_at, updated_at, created_by, updated_by, notes
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			'customer_kc_switch_test',
			1,
			phone,
			'Existing Founder',
			'existing-founder@example.com',
			'live',
			'trial',
			1,
			0,
			1,
			1,
			'test opt in',
			now,
			now,
			now,
			'test',
			'test',
			'Founder Form Registration'
		).run();

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, _init) => {
			const url = typeof input === 'string' ? input : input.url;

			if (url.includes('challenges.cloudflare.com/turnstile')) {
				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			if (url.includes('api.twilio.com/')) {
				return new Response(JSON.stringify({ sid: 'SM123' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		const request = new Request('http://localhost/api/founder/register?company_id=1', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				name: 'KC Switch Tester',
				phone,
				cf_token: 'turnstile-test-token',
				consent_sms: 'yes',
				consent_terms: 'yes',
				program_mode: 'kc',
				x_studio_kc_terms_accepted: 'yes',
				x_studio_founder_terms_accepted: 'no',
				x_studio_membership_type: 'KC',
				x_studio_notes: 'KC Form Registration'
			})
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);

		const customer = await env.DB.prepare(
			`SELECT founder_terms_accepted, kc_terms_accepted, founder_status FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();
		const otpRecord = await env.DB.prepare(
			`SELECT otp_code FROM otp_cache WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();

		expect(Number(customer?.founder_terms_accepted || 0)).toBe(0);
		expect(Number(customer?.kc_terms_accepted || 0)).toBe(1);
		expect(String(customer?.founder_status || '')).toBe('pending_verification');
		expect(String(otpRecord?.otp_code || '')).toMatch(/^\d{6}$/);
	});

	it('founder registration issues OTP without any external CRM dependency', async () => {
		await initializeDatabase(env.DB);

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, _init) => {
			const url = typeof input === 'string' ? input : input.url;

			if (url.includes('challenges.cloudflare.com/turnstile')) {
				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			if (url.includes('api.twilio.com/')) {
				return new Response(JSON.stringify({ sid: 'SM123' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		const phone = `+49175${Date.now().toString().slice(-8)}`;
		const request = new Request('http://localhost/api/founder/register?company_id=1', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				name: 'Founder Payload Test',
				phone,
				email: 'founder-payload@example.com',
				cf_token: 'turnstile-test-token',
				consent_sms: 'yes',
				consent_terms: 'yes',
				x_studio_founder_terms_accepted: 'yes',
				x_studio_membership_type: 'Founder',
				x_studio_notes: 'Founder Form Registration'
			})
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);

		const customer = await env.DB.prepare(
			`SELECT founder_status, founder_terms_accepted, kc_terms_accepted FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();
		const otpRecord = await env.DB.prepare(
			`SELECT otp_code FROM otp_cache WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();

		expect(String(customer?.founder_status || '')).toBe('pending_verification');
		expect(Number(customer?.founder_terms_accepted || 0)).toBe(1);
		expect(Number(customer?.kc_terms_accepted || 0)).toBe(0);
		expect(String(otpRecord?.otp_code || '')).toMatch(/^\d{6}$/);
	});

	it('founder verification consumes a valid OTP without external CRM sync', async () => {
		await initializeDatabase(env.DB);
		const now = new Date().toISOString();
		const phone = `+49173${Date.now().toString().slice(-8)}`;

		await env.DB.prepare(`
			INSERT INTO customers (
				id, company_id, phone, name, email,
				founder_status, founder_level, founder_terms_accepted, kc_terms_accepted,
				otp_verified, sms_opt_in, opt_in_text, opt_in_timestamp,
				created_at, updated_at, created_by, updated_by, notes
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			'customer_verify_test',
			1,
			phone,
			'Founder Verify Test',
			'verify@example.com',
			'pending_verification',
			'trial',
			1,
			0,
			0,
			1,
			'test opt in',
			now,
			now,
			now,
			'test',
			'test',
			'Founder Form Registration'
		).run();

		await env.DB.prepare(`
			INSERT INTO otp_cache (
				id, company_id, phone, otp_code, expires_at,
				created_at, attempts, last_attempt, verified
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			'otp_verify_test',
			1,
			phone,
			'123456',
			new Date(Date.now() + 10 * 60 * 1000).toISOString(),
			now,
			0,
			now,
			0
		).run();

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, _init) => {
			const url = typeof input === 'string' ? input : input.url;

			if (url.includes('api.twilio.com/')) {
				return new Response(JSON.stringify({ sid: 'SM123' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		let request = new Request('http://localhost/api/founder/verify?company_id=1', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({ phone, otp: '123456' })
		});

		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		let customer = await env.DB.prepare(
			`SELECT founder_status, otp_verified FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();
		let otpRecord = await env.DB.prepare(
			`SELECT verified FROM otp_cache WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();

		expect(String(customer?.founder_status || '')).toBe('live');
		expect(Number(customer?.otp_verified || 0)).toBe(1);
		expect(Number(otpRecord?.verified || 0)).toBe(1);
	});

	it('allows founder re-registration for configured test exception phone', async () => {
		await initializeDatabase(env.DB);

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = typeof input === 'string' ? input : input.url;

			if (url.includes('challenges.cloudflare.com/turnstile')) {
				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			if (url.includes('api.twilio.com/')) {
				return new Response(JSON.stringify({ sid: 'SM123' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		const phone = '+491723855711';
		const now = new Date().toISOString();

		await env.DB.prepare(`
			INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(company_id, key) DO UPDATE SET
				value = excluded.value,
				description = excluded.description,
				updated_at = excluded.updated_at,
				updated_by = excluded.updated_by
		`).bind(
			1,
			'FOUNDER_TEST_EXCEPTION_PHONES',
			phone,
			'test exception phones',
			now,
			'test'
		).run();

		await env.DB.prepare(`
			INSERT INTO customers (
				id, company_id, phone, name, email,
				founder_status, founder_level, founder_terms_accepted, kc_terms_accepted,
				otp_verified, sms_opt_in, opt_in_text, opt_in_timestamp,
				created_at, updated_at, created_by, updated_by, notes
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(company_id, phone) DO UPDATE SET
				name = excluded.name,
				email = excluded.email,
				founder_status = excluded.founder_status,
				founder_level = excluded.founder_level,
				founder_terms_accepted = excluded.founder_terms_accepted,
				kc_terms_accepted = excluded.kc_terms_accepted,
				otp_verified = excluded.otp_verified,
				sms_opt_in = excluded.sms_opt_in,
				opt_in_text = excluded.opt_in_text,
				opt_in_timestamp = excluded.opt_in_timestamp,
				updated_at = excluded.updated_at,
				updated_by = excluded.updated_by,
				notes = excluded.notes
		`).bind(
			'customer_exception_phone',
			1,
			phone,
			'Test Existing Founder',
			'test-existing-founder@example.com',
			'live',
			'gold',
			1,
			0,
			1,
			1,
			'test opt in',
			now,
			now,
			now,
			'test',
			'test',
			'pre-existing founder'
		).run();

		const request = new Request('http://localhost/api/founder/register?company_id=1', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				name: 'Exception Founder',
				phone,
				cf_token: 'turnstile-test-token',
				consent_sms: 'yes',
				consent_terms: 'yes',
				x_studio_founder_terms_accepted: 'yes',
				x_studio_membership_type: 'Founder',
				x_studio_notes: 'Founder Form Registration'
			})
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			status: 'success',
			phone
		});

		const customer = await env.DB.prepare(
			`SELECT founder_status, otp_verified FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();

		expect(String(customer?.founder_status || '')).toBe('pending_verification');
		expect(Number(customer?.otp_verified ?? 1)).toBe(0);
	});

	it('hydrates founder KC links and labels from operational settings', async () => {
		await initializeDatabase(env.DB);
		const now = new Date().toISOString();

		const dynamicSettings = {
			website_url: 'https://tenant.example',
			kc_program_label: 'Colleague Club',
			kc_membership_type: 'KC',
			kc_redirect_link: '/colleague-club',
			kc_terms_link: '/club-terms',
			privacy_link: '/data-privacy'
		};

		for (const [key, value] of Object.entries(dynamicSettings)) {
			await env.DB.prepare(`
				INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
				VALUES (?, ?, ?, ?, ?, ?)
				ON CONFLICT(company_id, key) DO UPDATE SET
					value = excluded.value,
					description = excluded.description,
					updated_at = excluded.updated_at,
					updated_by = excluded.updated_by
			`).bind(
				1,
				key,
				value,
				'test dynamic founder defaults',
				now,
				'test'
			).run();
		}

		const request = new Request('http://localhost/founder?company_id=1&program=kc', {
			redirect: 'manual'
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(302);
		const location = response.headers.get('location') || '';
		const redirected = new URL(location);

		expect(redirected.pathname).toBe('/founder');
		expect(redirected.searchParams.get('program')).toBe('kc');
		expect(redirected.searchParams.get('website_url')).toBe('https://tenant.example');
		expect(redirected.searchParams.get('program_label')).toBe('Colleague Club');
		expect(redirected.searchParams.get('membership_type')).toBe('KC');
		expect(redirected.searchParams.get('redirect')).toBe('https://tenant.example/colleague-club');
		expect(redirected.searchParams.get('terms_url')).toBe('https://tenant.example/club-terms');
		expect(redirected.searchParams.get('privacy_url')).toBe('https://tenant.example/data-privacy');
	});

	it('renders neutral community headline for shared founder and KC forms', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://localhost/founder-form?company_id=1&program=kc&lang=en&website_url=https://tenant.example&program_label=Colleague%20Club&membership_type=KC&redirect=https://tenant.example/colleague-club&terms_url=https://tenant.example/club-terms&privacy_url=https://tenant.example/data-privacy');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain('Join the Community');
		expect(html).toContain('Membership');
		expect(html).not.toContain('KANTON Founder');
		expect(html).not.toContain('Activate Founder Access');
	});

	it('allows manager role to manage social settings but not full company profile', async () => {
		await initializeDatabase(env.DB);

		const getReq = new Request('http://localhost/api/admin/platform-config?company_id=1&pin=8888');
		let ctx = createExecutionContext();
		const getRes = await worker.fetch(getReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(getRes.status).toBe(200);

		const beforeBusinessHours = await env.DB.prepare(
			`SELECT value FROM settings WHERE company_id = ? AND key = ? LIMIT 1`
		).bind(1, 'business_hours_open').first();

		const socialPostReq = new Request('http://localhost/api/admin/platform-config?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '8888',
				company: null,
				operationalSettings: {
					social_instagram_url: 'https://instagram.com/manager-updated',
					business_hours_open: '11:00'
				},
				modules: {
					module_marketing_management: true
				}
			})
		});

		ctx = createExecutionContext();
		const socialPostRes = await worker.fetch(socialPostReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(socialPostRes.status).toBe(200);

		const socialSaved = await env.DB.prepare(
			`SELECT value FROM settings WHERE company_id = ? AND key = ? LIMIT 1`
		).bind(1, 'social_instagram_url').first();
		expect(String(socialSaved?.value || '')).toBe('https://instagram.com/manager-updated');

		const afterBusinessHours = await env.DB.prepare(
			`SELECT value FROM settings WHERE company_id = ? AND key = ? LIMIT 1`
		).bind(1, 'business_hours_open').first();
		expect(String(afterBusinessHours?.value || '')).toBe(String(beforeBusinessHours?.value || ''));

		const deniedCompanyPostReq = new Request('http://localhost/api/admin/platform-config?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '8888',
				company: {
					name: 'Manager cannot update profile'
				},
				operationalSettings: {},
				modules: {}
			})
		});

		ctx = createExecutionContext();
		const deniedCompanyPostRes = await worker.fetch(deniedCompanyPostReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(deniedCompanyPostRes.status).toBe(403);

		const mediaGetReq = new Request('http://localhost/api/admin/media-assets?company_id=1&pin=8888');
		ctx = createExecutionContext();
		const mediaGetRes = await worker.fetch(mediaGetReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(mediaGetRes.status).toBe(200);
	});

	it('returns go-live readiness checklist in admin platform config payload', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://localhost/api/admin/platform-config?company_id=1&pin=1234');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.goLiveReadiness).toBeTruthy();
		expect(Array.isArray(body.goLiveReadiness.items)).toBe(true);
		expect(typeof body.goLiveReadiness.publishReady).toBe('boolean');
		expect(typeof body.goLiveReadiness.goLiveReady).toBe('boolean');
		expect(String(body.goLiveReadiness.publishSummary || '')).toContain('publish');
		expect(String(body.goLiveReadiness.goLiveSummary || '')).toContain('go-live');
		expect(body.goLiveReadiness.items.some((item) => item.key === 'payment_setup')).toBe(true);
		expect(body.goLiveReadiness.items.some((item) => item.key === 'staff_setup')).toBe(true);

		const paymentItem = body.goLiveReadiness.items.find((item) => item.key === 'payment_setup');
		expect(paymentItem?.ok).toBe(false);
		expect(paymentItem?.requiredForPublish).toBe(false);
		expect(paymentItem?.requiredForGoLive).toBe(true);
	});

	it('stores selected demo payment method during platform signup', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://localhost/api/platform/signup', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				restaurant_name: 'Pay Method Diner',
				owner_email: 'pay-method@example.com',
				subdomain: 'pay-method-diner',
				plan: 'core',
				admin_pin: '1234',
				admin_name: 'Owner',
				demo_payment_method: 'paypal'
			})
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(String(body.payment?.paymentMethod || '')).toBe('paypal');

		const companyId = Number(body.company_id || 0);
		const methodSetting = await env.DB.prepare(
			`SELECT value FROM settings WHERE company_id = ? AND key = 'demo_payment_method' LIMIT 1`
		).bind(companyId).first();
		const acceptedSetting = await env.DB.prepare(
			`SELECT value FROM settings WHERE company_id = ? AND key = 'accepted_payment_methods_json' LIMIT 1`
		).bind(companyId).first();

		expect(String(methodSetting?.value || '')).toBe('paypal');
		expect(String(acceptedSetting?.value || '')).toContain('paypal');
	});

	it('creates a Stripe test checkout session in mock mode for bank card signup', async () => {
		await initializeDatabase(env.DB);
		env.STRIPE_MODE = 'mock';

		const request = new Request('http://localhost/api/platform/signup', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				restaurant_name: 'Stripe Test Diner',
				owner_email: 'stripe-test@example.com',
				subdomain: 'stripe-test-diner',
				plan: 'core',
				admin_pin: '1234',
				admin_name: 'Owner',
				demo_payment_method: 'bankcard'
			})
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(String(body.payment?.paymentStatus || '')).toBe('stripe_checkout_pending');
		expect(String(body.checkout_url || '')).toContain('checkout=success');
		expect(String(body.checkout_url || '')).toContain('session_id=cs_test_mock_');

		const companyId = Number(body.company_id || 0);
		const statusSetting = await env.DB.prepare(
			`SELECT value FROM settings WHERE company_id = ? AND key = 'demo_payment_status' LIMIT 1`
		).bind(companyId).first();
		expect(String(statusSetting?.value || '')).toBe('stripe_checkout_pending');
	});

	it('confirms a pending Stripe checkout signup through the post-checkout confirmation path', async () => {
		await initializeDatabase(env.DB);
		env.STRIPE_MODE = 'mock';

		let request = new Request('http://localhost/api/platform/signup', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				restaurant_name: 'Stripe Confirm Diner',
				owner_email: 'stripe-confirm@example.com',
				subdomain: 'stripe-confirm-diner',
				plan: 'core',
				admin_pin: '1234',
				admin_name: 'Owner',
				demo_payment_method: 'bankcard'
			})
		});

		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const signupBody = await response.json();
		expect(response.status).toBe(201);
		const companyId = Number(signupBody.company_id || 0);
		const sessionId = String(signupBody.payment?.checkoutSessionId || '');
		expect(sessionId).toContain('cs_test_mock_');

		request = new Request(`http://localhost/api/platform/signup/confirm-payment?company_id=${companyId}&session_id=${encodeURIComponent(sessionId)}`);
		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const confirmBody = await response.json();
		expect(confirmBody.ok).toBe(true);
		expect(String(confirmBody.payment_status || '')).toBe('stripe_paid');

		const signupRow = await env.DB.prepare(
			`SELECT payment_status, payment_confirmed_at FROM platform_signups WHERE company_id = ? LIMIT 1`
		).bind(companyId).first();
		const statusSetting = await env.DB.prepare(
			`SELECT value FROM settings WHERE company_id = ? AND key = 'demo_payment_status' LIMIT 1`
		).bind(companyId).first();
		expect(String(signupRow?.payment_status || '')).toBe('stripe_paid');
		expect(String(signupRow?.payment_confirmed_at || '')).not.toBe('');
		expect(String(statusSetting?.value || '')).toBe('stripe_paid');
	});

	it('updates pending Stripe checkout state to paid through the Stripe webhook', async () => {
		await initializeDatabase(env.DB);
		env.STRIPE_MODE = 'mock';

		let request = new Request('http://localhost/api/platform/signup', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				restaurant_name: 'Webhook Paid Diner',
				owner_email: 'webhook-paid@example.com',
				subdomain: 'webhook-paid-diner',
				plan: 'core',
				admin_pin: '1234',
				admin_name: 'Owner',
				demo_payment_method: 'bankcard'
			})
		});

		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const signupBody = await response.json();
		const companyId = Number(signupBody.company_id || 0);
		const sessionId = String(signupBody.payment?.checkoutSessionId || '');

		request = new Request('http://localhost/api/integrations/stripe/webhook', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				type: 'checkout.session.completed',
				data: {
					object: {
						id: sessionId,
						metadata: { company_id: String(companyId) }
					}
				}
			})
		});

		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);

		const signupRow = await env.DB.prepare(
			`SELECT payment_status, payment_confirmed_at FROM platform_signups WHERE company_id = ? LIMIT 1`
		).bind(companyId).first();
		expect(String(signupRow?.payment_status || '')).toBe('stripe_paid');
		expect(String(signupRow?.payment_confirmed_at || '')).not.toBe('');
	});

	it('accepts a Stripe webhook with a valid signed payload', async () => {
		await initializeDatabase(env.DB);
		env.STRIPE_MODE = 'mock';

		let request = new Request('http://localhost/api/platform/signup', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				restaurant_name: 'Signed Webhook Diner',
				owner_email: 'signed-webhook@example.com',
				subdomain: 'signed-webhook-diner',
				plan: 'core',
				admin_pin: '1234',
				admin_name: 'Owner',
				demo_payment_method: 'bankcard'
			})
		});

		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const signupBody = await response.json();
		const companyId = Number(signupBody.company_id || 0);
		const sessionId = String(signupBody.payment?.checkoutSessionId || '');

		env.STRIPE_MODE = '';
		env.STRIPE_WEBHOOK_SECRET = 'whsec_test_signature_secret';
		const payload = JSON.stringify({
			type: 'checkout.session.completed',
			data: { object: { id: sessionId, metadata: { company_id: String(companyId) } } }
		});
		const signatureHeader = await createStripeSignatureHeader(env.STRIPE_WEBHOOK_SECRET, payload);

		request = new Request('http://localhost/api/integrations/stripe/webhook', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'stripe-signature': signatureHeader
			},
			body: payload
		});

		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(String(body.payment_status || '')).toBe('stripe_paid');
	});

	it('updates pending Stripe checkout state to expired through the Stripe webhook', async () => {
		await initializeDatabase(env.DB);
		env.STRIPE_MODE = 'mock';

		let request = new Request('http://localhost/api/platform/signup', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				restaurant_name: 'Webhook Expired Diner',
				owner_email: 'webhook-expired@example.com',
				subdomain: 'webhook-expired-diner',
				plan: 'core',
				admin_pin: '1234',
				admin_name: 'Owner',
				demo_payment_method: 'bankcard'
			})
		});

		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const signupBody = await response.json();
		const companyId = Number(signupBody.company_id || 0);
		const sessionId = String(signupBody.payment?.checkoutSessionId || '');

		request = new Request('http://localhost/api/integrations/stripe/webhook', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				type: 'checkout.session.expired',
				data: {
					object: {
						id: sessionId,
						metadata: { company_id: String(companyId) }
					}
				}
			})
		});

		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);

		const signupRow = await env.DB.prepare(
			`SELECT payment_status, payment_confirmed_at FROM platform_signups WHERE company_id = ? LIMIT 1`
		).bind(companyId).first();
		expect(String(signupRow?.payment_status || '')).toBe('stripe_expired');
		expect(String(signupRow?.payment_confirmed_at || '')).toBe('');
	});

	it('creates a new Stripe checkout session when retrying a failed signup payment', async () => {
		await initializeDatabase(env.DB);
		env.STRIPE_MODE = 'mock';

		let request = new Request('http://localhost/api/platform/signup', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				restaurant_name: 'Retry Checkout Diner',
				owner_email: 'retry-checkout@example.com',
				subdomain: 'retry-checkout-diner',
				plan: 'core',
				admin_pin: '1234',
				admin_name: 'Owner',
				demo_payment_method: 'bankcard'
			})
		});

		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const signupBody = await response.json();
		const companyId = Number(signupBody.company_id || 0);
		const signupIdRow = await env.DB.prepare(`SELECT id FROM platform_signups WHERE company_id = ? LIMIT 1`).bind(companyId).first();

		request = new Request('http://localhost/api/integrations/stripe/webhook', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				type: 'checkout.session.expired',
				data: { object: { id: String(signupBody.payment?.checkoutSessionId || ''), metadata: { company_id: String(companyId) } } }
			})
		});
		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		request = new Request(`http://localhost/api/platform/admin/signups/${encodeURIComponent(String(signupIdRow?.id || ''))}/retry-payment`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: '1234' })
		});
		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const retryBody = await response.json();
		expect(retryBody.ok).toBe(true);
		expect(String(retryBody.session_id || '')).toContain('cs_test_mock_');

		const signupRow = await env.DB.prepare(
			`SELECT payment_status, payment_reference FROM platform_signups WHERE id = ? LIMIT 1`
		).bind(String(signupIdRow?.id || '')).first();
		expect(String(signupRow?.payment_status || '')).toBe('stripe_checkout_pending');
		expect(String(signupRow?.payment_reference || '')).toBe(String(retryBody.session_id || ''));

		const events = await env.DB.prepare(
			`SELECT event_type FROM payment_events WHERE signup_id = ? ORDER BY created_at DESC LIMIT 10`
		).bind(String(signupIdRow?.id || '')).all();
		const eventTypes = (events.results || []).map((row) => String(row.event_type || ''));
		expect(eventTypes).toContain('checkout_retry_created');
	});

	it('redirects founder route to standard contact link when membership module is disabled', async () => {
		await initializeDatabase(env.DB);
		const now = new Date().toISOString();

		await env.DB.prepare(`
			INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(company_id, key) DO UPDATE SET
				value = excluded.value,
				description = excluded.description,
				updated_at = excluded.updated_at,
				updated_by = excluded.updated_by
		`).bind(1, 'module_membership_management', 'disabled', 'test', now, 'test').run();

		await env.DB.prepare(`
			INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(company_id, key) DO UPDATE SET
				value = excluded.value,
				description = excluded.description,
				updated_at = excluded.updated_at,
				updated_by = excluded.updated_by
		`).bind(1, 'standard_contact_link', '/kontakt', 'test', now, 'test').run();

		const request = new Request('http://localhost/founder?company_id=1&program=kc', {
			redirect: 'manual'
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(302);
		expect(response.headers.get('location') || '').toContain('/kontakt');
	});

	it('rejects booking create when booking module is disabled', async () => {
		await initializeDatabase(env.DB);
		const now = new Date().toISOString();

		await env.DB.prepare(`
			INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(company_id, key) DO UPDATE SET
				value = excluded.value,
				description = excluded.description,
				updated_at = excluded.updated_at,
				updated_by = excluded.updated_by
		`).bind(1, 'module_booking_management', 'disabled', 'test', now, 'test').run();

		const formData = new FormData();
		formData.set('name', 'Booking Test');
		formData.set('phone', '+4917612345678');
		formData.set('date', '2026-12-31');
		formData.set('time', '18:00');
		formData.set('pax', '2');
		formData.set('cf_token', 'token');

		const request = new Request('http://localhost/api/bookings/create?company_id=1', {
			method: 'POST',
			body: formData
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(String(body.error || '')).toContain('Booking management module is disabled');
	});

	it('allows empty tenant subdomain for single-domain mode', async () => {
		await initializeDatabase(env.DB);

		const baseline = await env.DB.prepare(
			`SELECT name, email, phone, timezone FROM companies WHERE id = ? LIMIT 1`
		).bind(1).first();

		const request = new Request('http://localhost/api/admin/platform-config?company_id=1', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '1234',
				company: {
					name: baseline?.name || '',
					email: baseline?.email || '',
					phone: baseline?.phone || '',
					subdomain: '',
					timezone: baseline?.timezone || 'UTC'
				},
				operationalSettings: {},
				modules: {}
			})
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(body.success).toBe(true);
		expect(String(body?.company?.subdomain ?? '__missing__')).toBe('');

		const company = await env.DB.prepare(
			`SELECT subdomain FROM companies WHERE id = ? LIMIT 1`
		).bind(1).first();
		expect(String(company?.subdomain ?? '__missing__')).toBe('');
	});
});
