function toBytesFromBase64(base64) {
  const binary = atob(String(base64 || '').trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function importMasterKey(masterKeyRaw) {
  const normalized = String(masterKeyRaw || '').trim();
  if (!normalized) {
    throw new Error('TENANT_SECRETS_MASTER_KEY is missing');
  }

  let keyBytes;
  try {
    keyBytes = toBytesFromBase64(normalized);
  } catch {
    keyBytes = new TextEncoder().encode(normalized);
  }

  if (keyBytes.byteLength !== 32) {
    throw new Error('TENANT_SECRETS_MASTER_KEY must decode to 32 bytes');
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptOrganizationSecret(secretValue, masterKeyRaw) {
  const key = await importMasterKey(masterKeyRaw);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(String(secretValue || ''));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return {
    encryptedValue: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
    algorithm: 'AES-GCM'
  };
}

export async function decryptOrganizationSecret(record, masterKeyRaw) {
  if (!record?.encrypted_value || !record?.iv) return null;

  const key = await importMasterKey(masterKeyRaw);
  const encryptedBytes = toBytesFromBase64(record.encrypted_value);
  const ivBytes = toBytesFromBase64(record.iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: record.algorithm || 'AES-GCM', iv: ivBytes },
    key,
    encryptedBytes
  );

  return new TextDecoder().decode(decrypted);
}

export async function upsertOrganizationSecret(env, organizationId, key, plainValue, updatedBy) {
  const encrypted = await encryptOrganizationSecret(plainValue, env.TENANT_SECRETS_MASTER_KEY);

  await env.DB.prepare(`
    INSERT INTO organization_secrets (organization_id, key, encrypted_value, iv, algorithm, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(organization_id, key) DO UPDATE SET
      encrypted_value = excluded.encrypted_value,
      iv = excluded.iv,
      algorithm = excluded.algorithm,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).bind(
    organizationId,
    key,
    encrypted.encryptedValue,
    encrypted.iv,
    encrypted.algorithm,
    new Date().toISOString(),
    updatedBy
  ).run();
}

export async function getOrganizationSecret(env, organizationId, key) {
  const row = await env.DB.prepare(`
    SELECT encrypted_value, iv, algorithm
    FROM organization_secrets
    WHERE organization_id = ? AND key = ?
    LIMIT 1
  `).bind(organizationId, key).first();

  if (!row) return null;
  return decryptOrganizationSecret(row, env.TENANT_SECRETS_MASTER_KEY);
}

export async function getOrganizationSecretStatuses(env, organizationId, keys) {
  if (!organizationId || !Array.isArray(keys) || !keys.length) return {};

  const placeholders = keys.map(() => '?').join(', ');
  const result = await env.DB.prepare(`
    SELECT key, updated_at
    FROM organization_secrets
    WHERE organization_id = ? AND key IN (${placeholders})
  `).bind(organizationId, ...keys).all();

  const rows = result?.results || [];
  const map = {};
  for (const row of rows) {
    map[String(row.key)] = {
      isSet: true,
      managedBy: 'organization_secret_vault',
      updatedAt: row.updated_at || null
    };
  }

  for (const key of keys) {
    if (!map[key]) {
      map[key] = {
        isSet: false,
        managedBy: 'organization_secret_vault',
        updatedAt: null
      };
    }
  }

  return map;
}