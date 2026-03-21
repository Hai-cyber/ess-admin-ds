/**
 * Odoo JSON-RPC API client for Cloudflare Workers
 *
 * Compatible with Odoo 14+ /web/dataset/call_kw endpoint.
 * Auth: API key (User API Key) passed as an HTTP Bearer token — same mechanism
 * that Make.com's odoo:makeApiCall module uses under the hood.
 *
 * Odoo CRM stage map (matches legacy make.com flow):
 *   1 = New / Pending
 *   2 = Confirmed
 *   3 = Arrived
 *   4 = Done
 *   5 = Cancelled
 *   6 = No-show
 */

/**
 * Generic Odoo JSON-RPC call_kw wrapper.
 *
 * @param {string} baseUrl    - e.g. "https://hais-lab.odoo.com"
 * @param {string} apiToken   - Odoo user API key
 * @param {string} model      - Odoo model name, e.g. "crm.lead"
 * @param {string} method     - ORM method, e.g. "create" | "write" | "read_group"
 * @param {Array}  args       - Positional arguments
 * @param {Object} [kwargs]   - Keyword arguments (merged with default context)
 * @returns {Promise<{ok: boolean, result?: any, error?: string}>}
 */
export async function callOdooKw(baseUrl, apiToken, model, method, args = [], kwargs = {}) {
  const endpoint = String(baseUrl || '').replace(/\/+$/, '') + '/web/dataset/call_kw';

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now() & 0x7fffffff,
    params: {
      model,
      method,
      args,
      kwargs: { context: {}, ...kwargs }
    }
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    return { ok: false, error: `Network error calling Odoo: ${err?.message || err}` };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, error: `Odoo HTTP ${response.status}: ${text.slice(0, 400)}` };
  }

  let json;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: 'Odoo returned non-JSON response' };
  }

  if (json?.error) {
    const message = (
      json.error?.data?.message ||
      json.error?.message ||
      JSON.stringify(json.error).slice(0, 400)
    );
    return { ok: false, error: message };
  }

  return { ok: true, result: json.result };
}

/**
 * Create a crm.lead (opportunity) record in Odoo CRM.
 *
 * Fields mirror the legacy make.com "Online Booking Form" flow (step 6):
 *   type, name, team_id, stage_id, contact_name, phone, email_from,
 *   x_studio_booking_datetime, x_studio_guests, x_studio_area,
 *   x_studio_submitted_at, x_studio_flag, x_studio_staff,
 *   x_studio_duration_min, x_studio_source, x_studio_notes
 *
 * @param {string} baseUrl
 * @param {string} apiToken
 * @param {Object} fields    - Odoo field values for the new record
 * @returns {Promise<{ok: boolean, leadId?: number, error?: string}>}
 */
export async function odooCreateCrmLead(baseUrl, apiToken, fields) {
  const result = await callOdooKw(baseUrl, apiToken, 'crm.lead', 'create', [[fields]]);
  if (!result.ok) return result;

  const leadId = typeof result.result === 'number' ? result.result : null;
  return { ok: true, leadId };
}

/**
 * Write (update) fields on an existing crm.lead.
 * Used for stage updates from the booking board.
 *
 * @param {string} baseUrl
 * @param {string} apiToken
 * @param {number} leadId   - Odoo integer record ID returned by odooCreateCrmLead
 * @param {Object} fields   - Fields to update, e.g. { stage_id: 3 }
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function odooWriteLead(baseUrl, apiToken, leadId, fields) {
  const result = await callOdooKw(baseUrl, apiToken, 'crm.lead', 'write', [[leadId], fields]);
  if (!result.ok) return result;
  return { ok: true };
}
