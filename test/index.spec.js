import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { afterEach, describe, it, expect, vi } from 'vitest';
import worker from '../src';
import { initializeDatabase } from '../src/db/init';

afterEach(() => {
	vi.restoreAllMocks();
});

async function readSseChunkWithTimeout(reader, timeoutMs = 1200) {
	const timeoutPromise = new Promise((_, reject) => {
		setTimeout(() => reject(new Error('timeout')), timeoutMs);
	});

	try {
		const result = await Promise.race([reader.read(), timeoutPromise]);
		if (!result || result.done) return '';
		return new TextDecoder().decode(result.value || new Uint8Array());
	} catch (error) {
		if (String(error?.message || '') === 'timeout') {
			return null;
		}
		throw error;
	}
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

			if (url.includes('your-odoo-endpoint.example')) {
				return new Response('ok', { status: 200 });
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		const phone = `+49176${Date.now().toString().slice(-8)}`;
		const request = new Request('http://restaurant1.quan-esskultur.de/api/kc/register', {
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

		const request = new Request('http://restaurant1.quan-esskultur.de/api/founder/register', {
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

		const request = new Request('http://restaurant1.quan-esskultur.de/founder?program=kc', {
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

	it('allows manager role to manage social settings but not full company profile', async () => {
		await initializeDatabase(env.DB);

		const getReq = new Request('http://restaurant1.quan-esskultur.de/api/admin/platform-config?pin=8888');
		let ctx = createExecutionContext();
		const getRes = await worker.fetch(getReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(getRes.status).toBe(200);

		const beforeBusinessHours = await env.DB.prepare(
			`SELECT value FROM settings WHERE company_id = ? AND key = ? LIMIT 1`
		).bind(1, 'business_hours_open').first();

		const socialPostReq = new Request('http://restaurant1.quan-esskultur.de/api/admin/platform-config', {
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

		const deniedCompanyPostReq = new Request('http://restaurant1.quan-esskultur.de/api/admin/platform-config', {
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

		const mediaGetReq = new Request('http://restaurant1.quan-esskultur.de/api/admin/media-assets?pin=8888');
		ctx = createExecutionContext();
		const mediaGetRes = await worker.fetch(mediaGetReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(mediaGetRes.status).toBe(200);
	});

	it('enforces tenant isolation for same staff PIN and booking reads by subdomain', async () => {
		await initializeDatabase(env.DB);

		const company1CreateReq = new Request('http://restaurant1.quan-esskultur.de/api/test/booking/create', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: 'Tenant One Guest',
				phone: '+491701111111',
				date: '2026-12-31',
				time: '18:00',
				pax: 2,
				area: 'indoor'
			})
		});

		let ctx = createExecutionContext();
		const company1CreateRes = await worker.fetch(company1CreateReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(company1CreateRes.status).toBe(200);
		const company1CreateBody = await company1CreateRes.json();
		expect(company1CreateBody.ok).toBe(true);

		const company2CreateReq = new Request('http://restaurant2.quan-esskultur.de/api/test/booking/create', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: 'Tenant Two Guest',
				phone: '+491702222222',
				date: '2026-12-31',
				time: '19:00',
				pax: 3,
				area: 'outdoor'
			})
		});

		ctx = createExecutionContext();
		const company2CreateRes = await worker.fetch(company2CreateReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(company2CreateRes.status).toBe(200);
		const company2CreateBody = await company2CreateRes.json();
		expect(company2CreateBody.ok).toBe(true);

		const company1BookingsReq = new Request('http://restaurant1.quan-esskultur.de/api/bookings');
		ctx = createExecutionContext();
		const company1BookingsRes = await worker.fetch(company1BookingsReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(company1BookingsRes.status).toBe(200);
		const company1BookingsBody = await company1BookingsRes.json();
		expect(company1BookingsBody.companyId).toBe(1);
		expect(Array.isArray(company1BookingsBody.data)).toBe(true);
		expect(company1BookingsBody.data.some((b) => b.id === company1CreateBody.bookingId)).toBe(true);
		expect(company1BookingsBody.data.some((b) => b.id === company2CreateBody.bookingId)).toBe(false);

		const company2BookingsReq = new Request('http://restaurant2.quan-esskultur.de/api/bookings');
		ctx = createExecutionContext();
		const company2BookingsRes = await worker.fetch(company2BookingsReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(company2BookingsRes.status).toBe(200);
		const company2BookingsBody = await company2BookingsRes.json();
		expect(company2BookingsBody.companyId).toBe(2);
		expect(Array.isArray(company2BookingsBody.data)).toBe(true);
		expect(company2BookingsBody.data.some((b) => b.id === company2CreateBody.bookingId)).toBe(true);
		expect(company2BookingsBody.data.some((b) => b.id === company1CreateBody.bookingId)).toBe(false);

		const samePinCompany1Req = new Request('http://restaurant1.quan-esskultur.de/api/staff/auth?pin=1111');
		ctx = createExecutionContext();
		const samePinCompany1Res = await worker.fetch(samePinCompany1Req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(samePinCompany1Res.status).toBe(200);
		const samePinCompany1Body = await samePinCompany1Res.json();
		expect(samePinCompany1Body.success).toBe(true);
		expect(samePinCompany1Body.companyId).toBe(1);

		const samePinCompany2Req = new Request('http://restaurant2.quan-esskultur.de/api/staff/auth?pin=1111');
		ctx = createExecutionContext();
		const samePinCompany2Res = await worker.fetch(samePinCompany2Req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(samePinCompany2Res.status).toBe(200);
		const samePinCompany2Body = await samePinCompany2Res.json();
		expect(samePinCompany2Body.success).toBe(true);
		expect(samePinCompany2Body.companyId).toBe(2);
	});

	it('blocks cross-tenant booking stage updates via body companyId override', async () => {
		await initializeDatabase(env.DB);

		const createReq = new Request('http://restaurant1.quan-esskultur.de/api/test/booking/create', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: 'Stage Isolation Guest',
				phone: '+491703333333',
				date: '2026-12-31',
				time: '20:00',
				pax: 2,
				area: 'indoor'
			})
		});

		let ctx = createExecutionContext();
		const createRes = await worker.fetch(createReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(createRes.status).toBe(200);
		const createBody = await createRes.json();
		expect(createBody.ok).toBe(true);

		const updateReq = new Request(`http://restaurant1.quan-esskultur.de/api/bookings/${encodeURIComponent(createBody.bookingId)}/stage`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				stage: 'confirmed',
				staffId: 'staff_1',
				companyId: 2
			})
		});

		ctx = createExecutionContext();
		const updateRes = await worker.fetch(updateReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(updateRes.status).toBe(403);
		const updateBody = await updateRes.json();
		expect(updateBody.ok).toBe(false);
		expect(String(updateBody.error || '')).toContain('company_id override');

		const booking = await env.DB.prepare(
			`SELECT stage FROM bookings WHERE company_id = ? AND id = ? LIMIT 1`
		).bind(1, createBody.bookingId).first();

		expect(String(booking?.stage || '')).toBe('pending');
	});

	it('routes booking creation and stage-update SSE notifications per company', async () => {
		await initializeDatabase(env.DB);

		const streamCompany1Req = new Request('http://restaurant1.quan-esskultur.de/api/notifications/stream');
		const streamCompany2Req = new Request('http://restaurant2.quan-esskultur.de/api/notifications/stream');

		let ctx = createExecutionContext();
		const streamCompany1Res = await worker.fetch(streamCompany1Req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(streamCompany1Res.status).toBe(200);

		ctx = createExecutionContext();
		const streamCompany2Res = await worker.fetch(streamCompany2Req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(streamCompany2Res.status).toBe(200);

		const readerCompany1 = streamCompany1Res.body?.getReader();
		const readerCompany2 = streamCompany2Res.body?.getReader();
		expect(readerCompany1).toBeTruthy();
		expect(readerCompany2).toBeTruthy();

		const connectedChunkCompany1 = await readSseChunkWithTimeout(readerCompany1, 1500);
		const connectedChunkCompany2 = await readSseChunkWithTimeout(readerCompany2, 1500);
		expect(String(connectedChunkCompany1 || '')).toContain('event: connected');
		expect(String(connectedChunkCompany2 || '')).toContain('event: connected');

		const createCompany1Req = new Request('http://restaurant1.quan-esskultur.de/api/test/booking/create', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: 'Notify Company 1',
				phone: '+491704444444',
				date: '2026-12-31',
				time: '21:00',
				pax: 2,
				area: 'indoor'
			})
		});

		ctx = createExecutionContext();
		const createCompany1Res = await worker.fetch(createCompany1Req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(createCompany1Res.status).toBe(200);
		const createCompany1Body = await createCompany1Res.json();
		expect(createCompany1Body.ok).toBe(true);

		const bookingEventCompany1 = await readSseChunkWithTimeout(readerCompany1, 1500);
		expect(String(bookingEventCompany1 || '')).toContain('event: booking');
		expect(String(bookingEventCompany1 || '')).toContain(createCompany1Body.bookingId);

		const updateCompany1Req = new Request(`http://restaurant1.quan-esskultur.de/api/bookings/${encodeURIComponent(createCompany1Body.bookingId)}/stage`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				stage: 'confirmed',
				staffId: 'staff_1'
			})
		});

		ctx = createExecutionContext();
		const updateCompany1Res = await worker.fetch(updateCompany1Req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(updateCompany1Res.status).toBe(200);

		const stageEventCompany1 = await readSseChunkWithTimeout(readerCompany1, 1500);
		expect(String(stageEventCompany1 || '')).toContain('event: stage-update');
		expect(String(stageEventCompany1 || '')).toContain(createCompany1Body.bookingId);

		const createCompany2Req = new Request('http://restaurant2.quan-esskultur.de/api/test/booking/create', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: 'Notify Company 2',
				phone: '+491705555555',
				date: '2026-12-31',
				time: '21:30',
				pax: 3,
				area: 'outdoor'
			})
		});

		ctx = createExecutionContext();
		const createCompany2Res = await worker.fetch(createCompany2Req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(createCompany2Res.status).toBe(200);
		const createCompany2Body = await createCompany2Res.json();
		expect(createCompany2Body.ok).toBe(true);

		const bookingEventCompany2 = await readSseChunkWithTimeout(readerCompany2, 1500);
		expect(String(bookingEventCompany2 || '')).toContain('event: booking');
		expect(String(bookingEventCompany2 || '')).toContain(createCompany2Body.bookingId);

		await readerCompany1.cancel();
		await readerCompany2.cancel();
	});

	it('syncs booking create to configured Odoo webhook and stores odoo_lead_id', async () => {
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
			'ODOO_BOOKING_CREATE_WEBHOOK',
			'https://booking-sync.example/odoo',
			'test booking create webhook',
			now,
			'test'
		).run();

		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const requestUrl = typeof input === 'string' ? input : input.url;

			if (requestUrl.includes('challenges.cloudflare.com/turnstile')) {
				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			if (requestUrl.includes('booking-sync.example/odoo')) {
				return new Response(JSON.stringify({ odoo_lead_id: 'odoo_lead_123' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		const formData = new FormData();
		formData.set('name', 'Booking Lead Guest');
		formData.set('phone', '+491701234567');
		formData.set('email', 'lead-guest@example.com');
		formData.set('date', '2026-12-31');
		formData.set('time', '19:15');
		formData.set('pax', '4');
		formData.set('area', 'garden');
		formData.set('cf_token', 'turnstile-test-token');

		const request = new Request('http://restaurant1.quan-esskultur.de/api/bookings/create', {
			method: 'POST',
			body: formData
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);

		const calledWebhook = fetchSpy.mock.calls.some(([input]) => {
			const requestUrl = typeof input === 'string' ? input : input?.url;
			return String(requestUrl || '').includes('booking-sync.example/odoo');
		});
		expect(calledWebhook).toBe(true);

		const booking = await env.DB.prepare(
			`SELECT odoo_lead_id, area, stage FROM bookings WHERE company_id = ? AND id = ? LIMIT 1`
		).bind(1, body.bookingId).first();

		expect(String(booking?.odoo_lead_id || '')).toBe('odoo_lead_123');
		expect(String(booking?.area || '')).toBe('garden');
		expect(String(booking?.stage || '')).toBe('pending');
		expect(fetchSpy).toHaveBeenCalled();
	});

	it('returns 400 tenant_required for main-domain bookings and staff auth routes', async () => {
		await initializeDatabase(env.DB);

		let ctx = createExecutionContext();
		const bookingsRes = await worker.fetch(new Request('http://quan-esskultur.de/api/bookings'), env, ctx);
		await waitOnExecutionContext(ctx);
		expect(bookingsRes.status).toBe(400);
		const bookingsBody = await bookingsRes.json();
		expect(bookingsBody.ok).toBe(false);
		expect(String(bookingsBody.error || '')).toBe('tenant_required');

		ctx = createExecutionContext();
		const staffAuthRes = await worker.fetch(new Request('http://quan-esskultur.de/api/staff/auth?pin=1111'), env, ctx);
		await waitOnExecutionContext(ctx);
		expect(staffAuthRes.status).toBe(400);
		const staffAuthBody = await staffAuthRes.json();
		expect(staffAuthBody.ok).toBe(false);
		expect(String(staffAuthBody.error || '')).toBe('tenant_required');
	});

	it('returns 404 tenant_subdomain_not_found for unknown-subdomain booking and founder pages', async () => {
		await initializeDatabase(env.DB);

		let ctx = createExecutionContext();
		const bookingFormRes = await worker.fetch(new Request('http://unknown.quan-esskultur.de/booking-form'), env, ctx);
		await waitOnExecutionContext(ctx);
		expect(bookingFormRes.status).toBe(404);
		const bookingFormBody = await bookingFormRes.json();
		expect(bookingFormBody.ok).toBe(false);
		expect(String(bookingFormBody.error || '')).toBe('tenant_subdomain_not_found');

		ctx = createExecutionContext();
		const founderRes = await worker.fetch(new Request('http://unknown.quan-esskultur.de/founder'), env, ctx);
		await waitOnExecutionContext(ctx);
		expect(founderRes.status).toBe(404);
		const founderBody = await founderRes.json();
		expect(founderBody.ok).toBe(false);
		expect(String(founderBody.error || '')).toBe('tenant_subdomain_not_found');
	});

	it('returns 400 tenant_required for main-domain notifications stream without opening SSE', async () => {
		await initializeDatabase(env.DB);

		const ctx = createExecutionContext();
		const response = await worker.fetch(new Request('http://quan-esskultur.de/api/notifications/stream'), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		expect(String(response.headers.get('content-type') || '')).toContain('application/json');
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(String(body.error || '')).toBe('tenant_required');
	});

	it('allows localhost and workers.dev company_id override when company exists', async () => {
		await initializeDatabase(env.DB);

		for (const host of ['localhost:8787', 'tenant-preview.workers.dev']) {
			const request = new Request(`http://${host}/api/bookings?company_id=2`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.ok).toBe(true);
			expect(Number(body.companyId)).toBe(2);
		}
	});

	it('returns 403 company_id_override_not_allowed for tenant host with mismatched company_id query', async () => {
		await initializeDatabase(env.DB);

		const request = new Request('http://restaurant1.quan-esskultur.de/api/bookings?company_id=2');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(String(body.error || '')).toBe('company_id_override_not_allowed');
	});

		it('syncs staff create/update to configured Odoo staff webhook', async () => {
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
				'ODOO_STAFF_SYNC_WEBHOOK',
				'https://staff-sync.example/odoo',
				'test staff sync webhook',
				now,
				'test'
			).run();

			let outboundPayload = null;
			const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
				const url = typeof input === 'string' ? input : input.url;

				if (url.includes('staff-sync.example/odoo')) {
					outboundPayload = JSON.parse(String(init?.body || '{}'));
					return new Response('ok', { status: 200 });
				}

				return new Response('Unhandled mock URL', { status: 500 });
			});

			const request = new Request('http://restaurant1.quan-esskultur.de/api/admin/staff', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					pin: '1234',
					staff: {
						name: 'Webhook Staff',
						pin: '4321',
						role: 'staff',
						is_active: 1,
						permissions: '["view_bookings"]'
					}
				})
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(fetchSpy).toHaveBeenCalledTimes(1);
			expect(outboundPayload).toMatchObject({
				_model: 'hr.employee',
				action: 'upsert',
				name: 'Webhook Staff',
				role: 'staff',
				is_active: true,
				company_id: 1,
				updated_by: 'Admin'
			});
			expect(Array.isArray(outboundPayload?.permissions)).toBe(true);
			expect(outboundPayload?.permissions).toContain('view_bookings');
			expect(typeof outboundPayload?.staff_id).toBe('string');
			expect(outboundPayload?.staff_id.length).toBeGreaterThan(0);
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

		const request = new Request('http://restaurant1.quan-esskultur.de/founder?program=kc', {
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

		const request = new Request('http://restaurant1.quan-esskultur.de/api/bookings/create', {
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
			`SELECT name, email, phone, timezone, odoo_url, odoo_company_id FROM companies WHERE id = ? LIMIT 1`
		).bind(1).first();

		const request = new Request('http://restaurant1.quan-esskultur.de/api/admin/platform-config', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pin: '1234',
				company: {
					name: baseline?.name || '',
					email: baseline?.email || '',
					phone: baseline?.phone || '',
					subdomain: '',
					timezone: baseline?.timezone || 'UTC',
					odoo_url: baseline?.odoo_url || '',
					odoo_company_id: baseline?.odoo_company_id ?? ''
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
