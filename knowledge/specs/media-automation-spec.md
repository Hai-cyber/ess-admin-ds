# Media Automation Specification

## Goal

Allow each tenant to upload photos and trigger marketing automation workflows safely and asynchronously.

## Flow

1. Tenant admin uploads media via front admin.
2. API stores object in tenant-scoped storage path.
3. Metadata record saved in D1.
4. Queue event emitted for automation worker.
5. Media automation worker enriches and routes campaign tasks.

## Storage Contract

- Bucket path convention:
  - tenants/{organization_id}/{company_id}/media/{asset_id}
- Metadata fields:
  - asset_id
  - company_id
  - organization_id
  - file_type
  - tags[]
  - channels[]
  - status (uploaded, approved, archived)

## Queue Contract

- Queue name: media-processing
- Event payload:
  - event_type: media.uploaded
  - company_id
  - asset_id
  - trigger_user
  - timestamp

## Automation Use Cases

- Build campaign-ready image sets.
- Trigger social posting workflows (manual approval gate optional).
- Feed newsletter/CRM segments with selected assets.
- Generate seasonal asset packs.

## Guardrails

- File type and size limits enforced at upload edge.
- Tenant cannot access other tenant assets.
- Moderation status required before external posting.

## Future Extensions

- AI-assisted caption suggestions.
- Auto-resize variants by channel profile.
- Multi-lingual campaign generation.
