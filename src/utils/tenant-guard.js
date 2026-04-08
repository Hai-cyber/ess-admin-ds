export function requireTenant(handler) {
  return async ({ request, env, ctx, tenant, url, activeCompanyResolution }) => {
    if (!activeCompanyResolution || !activeCompanyResolution.ok) {
      const reason = activeCompanyResolution?.reason || 'tenant_required';

      const map = {
        'db_unavailable': [503, 'db_unavailable'],
        'companies_table_missing': [503, 'tenant_table_missing'],
        'resolution_error': [500, 'tenant_resolution_error'],
        'override_not_allowed': [403, 'company_id_override_not_allowed'],
        'override_company_not_found': [404, 'company_not_found'],
        'tenant_company_not_found': [404, 'tenant_company_not_found'],
        'tenant_subdomain_not_found': [404, 'tenant_subdomain_not_found'],
        'tenant_subdomain_blocked': [423, 'tenant_subdomain_blocked'],
        'tenant_website_suspended': [423, 'tenant_website_suspended'],
        'no_tenant_context': [400, 'tenant_required'],
        'unresolved': [400, 'tenant_required']
      };

      const [status, errorCode] = map[reason] || [400, reason];
      return Response.json({ ok: false, error: errorCode }, { status });
    }

    return handler({
      request,
      env,
      ctx,
      tenant,
      url,
      companyId: activeCompanyResolution.companyId
    });
  };
}