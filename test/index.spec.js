import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { afterEach, describe, it, expect, vi } from 'vitest';
import worker from '../src';
import { initializeDatabase } from '../src/db/init';

afterEach(() => {
	vi.restoreAllMocks();
});

function jsonRpcResult(id, result) {
	return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

async function upsertCompanySetting(companyId, key, value, description = 'test setting') {
	const now = new Date().toISOString();
	await env.DB.prepare(`
		INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(company_id, key) DO UPDATE SET
			value = excluded.value,
			description = excluded.description,
			updated_at = excluded.updated_at,
			updated_by = excluded.updated_by
	`).bind(companyId, key, value, description, now, 'test').run();
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

	it('serves KC form UI wired to KC-specific API endpoints', async () => {
		await initializeDatabase(env.DB);

		const request = new Request(
			'http://example.com/founder?program=kc&website_url=https%3A%2F%2Fquan-esskultur.de&program_label=Kollegensclub&membership_type=KC&redirect=https%3A%2F%2Fquan-esskultur.de%2Fcolleague-club&terms_url=https%3A%2F%2Fquan-esskultur.de%2Ffounderpass-terms-conditions&privacy_url=https%3A%2F%2Fquan-esskultur.de%2Fprivacy'
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

			if (url.includes('your-odoo-endpoint.example')) {
				return new Response('ok', { status: 200 });
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		const phone = `+49176${Date.now().toString().slice(-8)}`;
		const request = new Request('http://example.com/api/kc/register?company_id=1', {
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
		const originalLegacyCreateWebhook = env.ODOO_FOUNDER_CREATE_WEBHOOK;
		env.ODOO_FOUNDER_CREATE_WEBHOOK = '';

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

		try {
			const phone = `+49179${Date.now().toString().slice(-8)}`;
			const request = new Request('http://example.com/api/kc/register?company_id=1', {
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
		} finally {
			env.ODOO_FOUNDER_CREATE_WEBHOOK = originalLegacyCreateWebhook;
		}
	});

	it('switching an existing founder contact to KC keeps only KC consent and KC-managed tags', async () => {
		await initializeDatabase(env.DB);
		const phone = `+49178${Date.now().toString().slice(-8)}`;
		const now = new Date().toISOString();
		const odooBaseUrl = 'https://odoo-kc-switch.test';
		let capturedFieldWrite = null;
		let capturedCategoryIds = null;

		await upsertCompanySetting(1, 'ODOO_BASE_URL', odooBaseUrl, 'test odoo base');
		await upsertCompanySetting(1, 'ODOO_DB_NAME', 'hais-lab', 'test odoo db');
		await upsertCompanySetting(1, 'ODOO_LOGIN', 'api@test.local', 'test odoo login');
		await upsertCompanySetting(1, 'ODOO_API_TOKEN', 'token-test', 'test odoo token');

		await env.DB.prepare(`
			INSERT INTO customers (
				id, company_id, phone, name, email,
				founder_status, founder_level, founder_terms_accepted, kc_terms_accepted,
				otp_verified, sms_opt_in, opt_in_text, opt_in_timestamp,
				odoo_register_sync_state, odoo_register_sync_attempts,
				created_at, updated_at, created_by, updated_by, notes
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
			'synced',
			1,
			now,
			now,
			'test',
			'test',
			'Founder Form Registration'
		).run();

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
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

			if (url === `${odooBaseUrl}/jsonrpc`) {
				const rpcBody = JSON.parse(String(init?.body || '{}'));
				const params = rpcBody?.params || {};
				const args = Array.isArray(params.args) ? params.args : [];

				if (params.service === 'common' && params.method === 'authenticate') {
					return jsonRpcResult(rpcBody.id, 7);
				}

				if (params.service === 'object' && params.method === 'execute_kw') {
					const model = String(args[3] || '');
					const method = String(args[4] || '');

					if (model === 'res.partner' && method === 'fields_get') {
						return jsonRpcResult(rpcBody.id, {
							name: { type: 'char' },
							phone: { type: 'char' },
							email: { type: 'char' },
							x_studio_membership_type: { type: 'char' },
							x_studio_sms_opt_in_1: { type: 'char' },
							x_studio_opt_in_text: { type: 'text' },
							x_studio_opt_in_timestamp: { type: 'char' },
							x_studio_founder_terms_accepted: { type: 'char' },
							x_studio_kc_terms_accepted: { type: 'char' },
							x_studio_otp_verified: { type: 'char' },
							x_studio_founder_status: { type: 'char' },
							x_studio_founder_level: { type: 'char' },
							x_studio_last_reminder_date: { type: 'char' },
							x_studio_total_spent: { type: 'float' },
							x_number_of_visits: { type: 'integer' },
							x_studio_notes: { type: 'text' },
							category_id: { type: 'many2many' }
						});
					}

					if (model === 'res.partner' && method === 'search_read') {
						if (Array.isArray(args?.[5]?.[0]) || Array.isArray(args?.[5])) {
							return jsonRpcResult(rpcBody.id, [{ id: 88, phone, category_id: [11, 12, 99] }]);
						}
						return jsonRpcResult(rpcBody.id, [{ id: 88, phone, category_id: [11, 12, 99] }]);
					}

					if (model === 'res.partner' && method === 'write') {
						const values = args?.[6]?.[1] || args?.[5]?.[1] || args?.[5] || {};
						if (values && values.category_id) {
							capturedCategoryIds = values.category_id?.[0]?.[2] || [];
						} else {
							capturedFieldWrite = values;
						}
						return jsonRpcResult(rpcBody.id, true);
					}

					if (model === 'res.partner' && method === 'read') {
						return jsonRpcResult(rpcBody.id, [{ id: 88, category_id: [11, 12, 99] }]);
					}

					if (model === 'res.partner.category' && method === 'search_read') {
						const domain = args?.[5]?.[0] || args?.[5] || [];
						const label = String(domain?.[0]?.[2] || '').trim();
						const idByLabel = {
							Founder: 11,
							'Founder Trial': 12,
							'KC Club': 21,
							Kollegensclub: 22
						};
						const resolvedId = idByLabel[label] || 0;
						return jsonRpcResult(rpcBody.id, resolvedId ? [{ id: resolvedId }] : []);
					}
				}

				return new Response('Unhandled Odoo RPC request', { status: 500 });
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		const request = new Request('http://example.com/api/founder/register?company_id=1', {
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

		expect(Number(customer?.founder_terms_accepted || 0)).toBe(0);
		expect(Number(customer?.kc_terms_accepted || 0)).toBe(1);
		expect(String(customer?.founder_status || '')).toBe('pending_verification');
		expect(capturedFieldWrite).toMatchObject({
			x_studio_membership_type: 'KC',
			x_studio_founder_terms_accepted: 'no',
			x_studio_kc_terms_accepted: 'yes'
		});
		expect(capturedCategoryIds).toEqual([99, 21, 22]);
	});

	it('sends a legacy-compatible Odoo contact payload before issuing OTP', async () => {
		await initializeDatabase(env.DB);
		let capturedOdooPayload = null;
		const odooBaseUrl = 'https://odoo-create.test';

		await upsertCompanySetting(1, 'ODOO_BASE_URL', odooBaseUrl, 'test odoo base');
		await upsertCompanySetting(1, 'ODOO_DB_NAME', 'hais-lab', 'test odoo db');
		await upsertCompanySetting(1, 'ODOO_LOGIN', 'api@test.local', 'test odoo login');
		await upsertCompanySetting(1, 'ODOO_API_TOKEN', 'token-test', 'test odoo token');

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
			const url = typeof input === 'string' ? input : input.url;

			if (url.includes('challenges.cloudflare.com/turnstile')) {
				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			if (url === `${odooBaseUrl}/jsonrpc`) {
				const rpcBody = JSON.parse(String(init?.body || '{}'));
				const params = rpcBody?.params || {};
				const args = Array.isArray(params.args) ? params.args : [];

				if (params.service === 'common' && params.method === 'authenticate') {
					return jsonRpcResult(rpcBody.id, 7);
				}

				if (params.service === 'object' && params.method === 'execute_kw') {
					const model = String(args[3] || '');
					const method = String(args[4] || '');

					if (model === 'res.partner' && method === 'fields_get') {
						return jsonRpcResult(rpcBody.id, {
							name: { type: 'char' },
							phone: { type: 'char' },
							email: { type: 'char' },
							x_studio_membership_type: { type: 'char' },
							x_studio_sms_opt_in_1: { type: 'char' },
							x_studio_opt_in_text: { type: 'text' },
							x_studio_opt_in_timestamp: { type: 'char' },
							x_studio_founder_terms_accepted: { type: 'char' },
							x_studio_kc_terms_accepted: { type: 'char' },
							x_studio_otp_verified: { type: 'char' },
							x_studio_founder_status: { type: 'char' },
							x_studio_founder_level: { type: 'char' },
							x_studio_last_reminder_date: { type: 'char' },
							x_studio_total_spent: { type: 'float' },
							x_number_of_visits: { type: 'integer' },
							x_studio_notes: { type: 'text' },
							category_id: { type: 'many2many' }
						});
					}

					if (model === 'res.partner' && method === 'search_read') {
						return jsonRpcResult(rpcBody.id, []);
					}

					if (model === 'res.partner' && method === 'create') {
						capturedOdooPayload = args?.[5]?.[0] || null;
						return jsonRpcResult(rpcBody.id, 501);
					}

					if (model === 'res.partner' && method === 'read') {
						return jsonRpcResult(rpcBody.id, [{ id: 501, category_id: [] }]);
					}

					if (model === 'res.partner' && method === 'write') {
						return jsonRpcResult(rpcBody.id, true);
					}

					if (model === 'res.partner.category' && method === 'search_read') {
						return jsonRpcResult(rpcBody.id, []);
					}

					if (model === 'res.partner.category' && method === 'create') {
						return jsonRpcResult(rpcBody.id, 701);
					}
				}

				return new Response('Unhandled Odoo RPC request', { status: 500 });
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
		const request = new Request('http://example.com/api/founder/register?company_id=1', {
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
		expect(capturedOdooPayload).toMatchObject({
			name: 'Founder Payload Test',
			phone,
			email: 'founder-payload@example.com',
			x_studio_membership_type: 'Founder',
			x_studio_sms_opt_in_1: 'yes',
			x_studio_founder_terms_accepted: 'yes',
			x_studio_kc_terms_accepted: 'no',
			x_studio_otp_verified: 'no',
			x_studio_founder_status: 'Pending Verification',
			x_studio_founder_level: 'Trial',
			x_studio_total_spent: 0,
			x_number_of_visits: 0,
			x_studio_notes: 'Founder Form Registration'
		});
		expect(String(capturedOdooPayload?.x_studio_opt_in_timestamp || '')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

		const customer = await env.DB.prepare(
			`SELECT odoo_register_sync_state, odoo_register_sync_attempts FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();

		expect(String(customer?.odoo_register_sync_state || '')).toBe('synced');
		expect(Number(customer?.odoo_register_sync_attempts || 0)).toBe(1);
	});

	it('uses legacy founder create webhook fallback when direct Odoo API config is unavailable', async () => {
		await initializeDatabase(env.DB);

		const originalBaseUrl = env.ODOO_BASE_URL;
		const originalDbName = env.ODOO_DB_NAME;
		const originalLogin = env.ODOO_LOGIN;
		const originalApiToken = env.ODOO_API_TOKEN;
		const originalPassword = env.ODOO_PASSWORD;
		const originalLegacyCreateWebhook = env.ODOO_FOUNDER_CREATE_WEBHOOK;
		const legacyCreateWebhook = 'https://legacy-create.test/webhook';

		let legacyWebhookCalled = false;

		env.ODOO_BASE_URL = '';
		env.ODOO_DB_NAME = '';
		env.ODOO_LOGIN = '';
		env.ODOO_API_TOKEN = '';
		env.ODOO_PASSWORD = '';
		env.ODOO_FOUNDER_CREATE_WEBHOOK = legacyCreateWebhook;

		try {
			vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
				const url = typeof input === 'string' ? input : input.url;

				if (url.includes('challenges.cloudflare.com/turnstile')) {
					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: { 'content-type': 'application/json' }
					});
				}

				if (url === legacyCreateWebhook) {
					legacyWebhookCalled = true;
					return new Response(JSON.stringify({ status: 'success' }), {
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

				if (url.includes('/jsonrpc')) {
					return new Response('Unexpected Odoo JSON-RPC call in webhook fallback test', { status: 500 });
				}

				return new Response('Unhandled mock URL', { status: 500 });
			});

			const phone = `+49170${Date.now().toString().slice(-8)}`;
			const request = new Request('http://example.com/api/founder/register?company_id=1', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					name: 'Legacy Fallback Founder',
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
			expect(legacyWebhookCalled).toBe(true);

			const customer = await env.DB.prepare(
				`SELECT odoo_register_sync_state, odoo_register_sync_attempts FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
			).bind(1, phone).first();

			expect(String(customer?.odoo_register_sync_state || '')).toBe('synced');
			expect(Number(customer?.odoo_register_sync_attempts || 0)).toBe(1);
		} finally {
			env.ODOO_BASE_URL = originalBaseUrl;
			env.ODOO_DB_NAME = originalDbName;
			env.ODOO_LOGIN = originalLogin;
			env.ODOO_API_TOKEN = originalApiToken;
			env.ODOO_PASSWORD = originalPassword;
			env.ODOO_FOUNDER_CREATE_WEBHOOK = originalLegacyCreateWebhook;
		}
	});

	it('retries pending registrations when the first Odoo create sync fails', async () => {
		await initializeDatabase(env.DB);
		let createAttempts = 0;
		const odooBaseUrl = 'https://odoo-retry.test';

		await upsertCompanySetting(1, 'ODOO_BASE_URL', odooBaseUrl, 'test odoo base');
		await upsertCompanySetting(1, 'ODOO_DB_NAME', 'hais-lab', 'test odoo db');
		await upsertCompanySetting(1, 'ODOO_LOGIN', 'api@test.local', 'test odoo login');
		await upsertCompanySetting(1, 'ODOO_API_TOKEN', 'token-test', 'test odoo token');

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
			const url = typeof input === 'string' ? input : input.url;

			if (url.includes('challenges.cloudflare.com/turnstile')) {
				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			if (url === `${odooBaseUrl}/jsonrpc`) {
				const rpcBody = JSON.parse(String(init?.body || '{}'));
				const params = rpcBody?.params || {};
				const args = Array.isArray(params.args) ? params.args : [];

				if (params.service === 'common' && params.method === 'authenticate') {
					return jsonRpcResult(rpcBody.id, 7);
				}

				if (params.service === 'object' && params.method === 'execute_kw') {
					const model = String(args[3] || '');
					const method = String(args[4] || '');

					if (model === 'res.partner' && method === 'fields_get') {
						return jsonRpcResult(rpcBody.id, {
							name: { type: 'char' },
							phone: { type: 'char' },
							email: { type: 'char' },
							x_studio_membership_type: { type: 'char' },
							x_studio_sms_opt_in_1: { type: 'char' },
							x_studio_opt_in_text: { type: 'text' },
							x_studio_opt_in_timestamp: { type: 'char' },
							x_studio_founder_terms_accepted: { type: 'char' },
							x_studio_kc_terms_accepted: { type: 'char' },
							x_studio_otp_verified: { type: 'char' },
							x_studio_founder_status: { type: 'char' },
							x_studio_founder_level: { type: 'char' },
							x_studio_last_reminder_date: { type: 'char' },
							x_studio_total_spent: { type: 'float' },
							x_number_of_visits: { type: 'integer' },
							x_studio_notes: { type: 'text' },
							category_id: { type: 'many2many' }
						});
					}

					if (model === 'res.partner' && method === 'search_read') {
						return jsonRpcResult(rpcBody.id, []);
					}

					if (model === 'res.partner' && method === 'create') {
						createAttempts += 1;
						if (createAttempts === 1) {
							return new Response('odoo unavailable', { status: 500 });
						}
						return jsonRpcResult(rpcBody.id, 601);
					}

					if (model === 'res.partner' && method === 'read') {
						return jsonRpcResult(rpcBody.id, [{ id: 601, category_id: [] }]);
					}

					if (model === 'res.partner' && method === 'write') {
						return jsonRpcResult(rpcBody.id, true);
					}

					if (model === 'res.partner.category' && method === 'search_read') {
						return jsonRpcResult(rpcBody.id, []);
					}

					if (model === 'res.partner.category' && method === 'create') {
						return jsonRpcResult(rpcBody.id, 801);
					}
				}

				return new Response('Unhandled Odoo RPC request', { status: 500 });
			}

			if (url.includes('api.twilio.com/')) {
				return new Response(JSON.stringify({ sid: 'SM123' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		const phone = `+49174${Date.now().toString().slice(-8)}`;
		const requestBody = JSON.stringify({
			name: 'Founder Retry Test',
			phone,
			cf_token: 'turnstile-test-token',
			consent_sms: 'yes',
			consent_terms: 'yes',
			x_studio_founder_terms_accepted: 'yes',
			x_studio_membership_type: 'Founder',
			x_studio_notes: 'Founder Form Registration'
		});

		let request = new Request('http://example.com/api/founder/register?company_id=1', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: requestBody
		});

		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(502);
		let customer = await env.DB.prepare(
			`SELECT founder_status, odoo_register_sync_state, odoo_register_sync_attempts FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();
		let otpRecord = await env.DB.prepare(
			`SELECT otp_code FROM otp_cache WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();

		expect(String(customer?.founder_status || '')).toBe('pending_verification');
		expect(String(customer?.odoo_register_sync_state || '')).toBe('failed');
		expect(Number(customer?.odoo_register_sync_attempts || 0)).toBe(1);
		expect(otpRecord).toBeNull();

		request = new Request('http://example.com/api/founder/register?company_id=1', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: requestBody
		});

		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		customer = await env.DB.prepare(
			`SELECT odoo_register_sync_state, odoo_register_sync_attempts FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();
		otpRecord = await env.DB.prepare(
			`SELECT otp_code FROM otp_cache WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();

		expect(createAttempts).toBe(2);
		expect(String(customer?.odoo_register_sync_state || '')).toBe('synced');
		expect(Number(customer?.odoo_register_sync_attempts || 0)).toBe(2);
		expect(String(otpRecord?.otp_code || '')).toMatch(/^\d{6}$/);
	});

	it('does not consume OTP when Odoo verify sync fails', async () => {
		await initializeDatabase(env.DB);
		const now = new Date().toISOString();
		let verifyAttempts = 0;
		const phone = `+49173${Date.now().toString().slice(-8)}`;
		const odooBaseUrl = 'https://odoo-verify.test';

		await upsertCompanySetting(1, 'ODOO_BASE_URL', odooBaseUrl, 'test odoo base');
		await upsertCompanySetting(1, 'ODOO_DB_NAME', 'hais-lab', 'test odoo db');
		await upsertCompanySetting(1, 'ODOO_LOGIN', 'api@test.local', 'test odoo login');
		await upsertCompanySetting(1, 'ODOO_API_TOKEN', 'token-test', 'test odoo token');

		await env.DB.prepare(`
			INSERT INTO customers (
				id, company_id, phone, name, email,
				founder_status, founder_level, founder_terms_accepted, kc_terms_accepted,
				otp_verified, sms_opt_in, opt_in_text, opt_in_timestamp,
				odoo_register_sync_state, odoo_register_sync_attempts,
				created_at, updated_at, created_by, updated_by, notes
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
			'synced',
			1,
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

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
			const url = typeof input === 'string' ? input : input.url;

			if (url === `${odooBaseUrl}/jsonrpc`) {
				const rpcBody = JSON.parse(String(init?.body || '{}'));
				const params = rpcBody?.params || {};
				const args = Array.isArray(params.args) ? params.args : [];

				if (params.service === 'common' && params.method === 'authenticate') {
					return jsonRpcResult(rpcBody.id, 7);
				}

				if (params.service === 'object' && params.method === 'execute_kw') {
					const model = String(args[3] || '');
					const method = String(args[4] || '');

					if (model === 'res.partner' && method === 'fields_get') {
						return jsonRpcResult(rpcBody.id, {
							phone: { type: 'char' },
							x_studio_membership_type: { type: 'char' },
							x_studio_founder_status: { type: 'char' },
							x_studio_otp_verified: { type: 'char' },
							updated_at: { type: 'char' }
						});
					}

					if (model === 'res.partner' && method === 'search_read') {
						return jsonRpcResult(rpcBody.id, [{ id: 42, phone }]);
					}

					if (model === 'res.partner' && method === 'write') {
						verifyAttempts += 1;
						if (verifyAttempts === 1) {
							return new Response('verify unavailable', { status: 500 });
						}
						return jsonRpcResult(rpcBody.id, true);
					}
				}

				return new Response('Unhandled Odoo RPC request', { status: 500 });
			}

			if (url.includes('api.twilio.com/')) {
				return new Response(JSON.stringify({ sid: 'SM123' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}

			return new Response('Unhandled mock URL', { status: 500 });
		});

		let request = new Request('http://example.com/api/founder/verify?company_id=1', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({ phone, otp: '123456' })
		});

		let ctx = createExecutionContext();
		let response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(502);
		let customer = await env.DB.prepare(
			`SELECT founder_status, otp_verified FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();
		let otpRecord = await env.DB.prepare(
			`SELECT verified FROM otp_cache WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();

		expect(String(customer?.founder_status || '')).toBe('pending_verification');
		expect(Number(customer?.otp_verified || 0)).toBe(0);
		expect(Number(otpRecord?.verified || 0)).toBe(0);

		request = new Request('http://example.com/api/founder/verify?company_id=1', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({ phone, otp: '123456' })
		});

		ctx = createExecutionContext();
		response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		customer = await env.DB.prepare(
			`SELECT founder_status, otp_verified FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();
		otpRecord = await env.DB.prepare(
			`SELECT verified FROM otp_cache WHERE company_id = ? AND phone = ? LIMIT 1`
		).bind(1, phone).first();

		expect(verifyAttempts).toBe(2);
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

		const request = new Request('http://example.com/api/founder/register?company_id=1', {
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

		const request = new Request('http://example.com/founder?program=kc', {
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

		const request = new Request('http://example.com/founder-form?program=kc&lang=en&website_url=https://tenant.example&program_label=Colleague%20Club&membership_type=KC&redirect=https://tenant.example/colleague-club&terms_url=https://tenant.example/club-terms&privacy_url=https://tenant.example/data-privacy');
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

		const getReq = new Request('http://example.com/api/admin/platform-config?pin=8888');
		let ctx = createExecutionContext();
		const getRes = await worker.fetch(getReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(getRes.status).toBe(200);

		const beforeBusinessHours = await env.DB.prepare(
			`SELECT value FROM settings WHERE company_id = ? AND key = ? LIMIT 1`
		).bind(1, 'business_hours_open').first();

		const socialPostReq = new Request('http://example.com/api/admin/platform-config', {
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

		const deniedCompanyPostReq = new Request('http://example.com/api/admin/platform-config', {
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

		const mediaGetReq = new Request('http://example.com/api/admin/media-assets?pin=8888');
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

		const request = new Request('http://example.com/founder?program=kc', {
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

		const request = new Request('http://example.com/api/bookings/create', {
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

		const request = new Request('http://example.com/api/admin/platform-config', {
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
