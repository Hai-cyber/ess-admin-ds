# Control Plane API (Operator Backend)

## Auth

- Required role: operator_admin.
- All routes deny tenant_admin and staff roles.

## Endpoints

### GET /api/control-plane/tenants

Returns paged list of organizations and companies with module states.

### GET /api/control-plane/tenants/:companyId/modules

Returns module toggle map and billing metadata for one company.

### POST /api/control-plane/tenants/:companyId/modules

Enable/disable one or more modules.

Request body example:

{
  "changes": [
    {
      "module": "module_media_management",
      "enabled": true,
      "reason": "Customer purchased monthly media package"
    }
  ]
}

### GET /api/control-plane/tenants/:companyId/services

Returns service inventory for website, staff app, booking board, email, POS adapters.

### POST /api/control-plane/tenants/:companyId/services

Activate or pause service units.

### GET /api/control-plane/audit

Returns operator audit stream for module and service changes.

## Response Standard

- success: boolean
- data: object|array
- error: structured error object when unsuccessful
- correlation_id: request trace id
