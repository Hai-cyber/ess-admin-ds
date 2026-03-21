# Tenant Admin API (Front Admin)

## Auth

- tenant_admin can read/write tenant self-service config.
- staff can read limited operational context only.

## Endpoints

### GET /api/tenant-admin/platform-config

Returns merged config for:
- company profile
- operations and capacities
- active modules
- social links and public IDs

### POST /api/tenant-admin/platform-config

Updates allowed self-service fields:
- staff policy-safe settings
- area/capacity values
- social links/public app IDs

### GET /api/tenant-admin/staff

List staff members for the company.

### POST /api/tenant-admin/staff

Create or update staff entries.

### GET /api/tenant-admin/media

List media assets and statuses.

### POST /api/tenant-admin/media/upload

Upload media metadata and request signed upload path.

### POST /api/tenant-admin/media/:assetId/tag

Update asset tags/channels for automation selection.

## Security Notes

- Secret provider tokens are never returned by this API.
- All requests are company-scoped and audited.
