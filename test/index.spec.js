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
		expect(String(company?.website_status || '')).toBe('published');
		expect(String(company?.trust_state || '')).toBe('trusted');
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
