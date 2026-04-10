#!/usr/bin/env node

const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')

function parseArgs(argv) {
  const parsed = {
    env: '',
    database: 'ess_admin_ds',
    remote: false,
    dryRun: false,
    verbose: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--remote') {
      parsed.remote = true
      continue
    }
    if (arg === '--dry-run') {
      parsed.dryRun = true
      continue
    }
    if (arg === '--verbose') {
      parsed.verbose = true
      continue
    }
    if (arg === '--env' && argv[index + 1]) {
      parsed.env = String(argv[index + 1]).trim()
      index += 1
      continue
    }
    if (arg.startsWith('--env=')) {
      parsed.env = String(arg.slice('--env='.length)).trim()
      continue
    }
    if (arg === '--database' && argv[index + 1]) {
      parsed.database = String(argv[index + 1]).trim() || parsed.database
      index += 1
      continue
    }
    if (arg.startsWith('--database=')) {
      parsed.database = String(arg.slice('--database='.length)).trim() || parsed.database
    }
  }

  return parsed
}

function sqlString(value) {
  if (value == null) return 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

function cleanText(value) {
  const normalized = String(value == null ? '' : value).trim()
  if (!normalized) return ''

  const lowered = normalized.toLowerCase()
  if (lowered === 'null' || lowered === 'undefined') return ''
  return normalized
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase()
}

function buildStableId(prefix, input, length = 24) {
  const hash = crypto.createHash('sha256').update(String(input || '')).digest('hex')
  return `${prefix}${hash.slice(0, length)}`
}

function runD1Json(options, command) {
  const args = ['wrangler', 'd1', 'execute', options.database, '--json', '--command', command]
  if (options.env) {
    args.push('--env', options.env)
  }
  if (options.remote) {
    args.push('--remote')
  }

  const stdout = execFileSync('npx', args, {
    cwd: process.cwd(),
    encoding: 'utf8'
  })

  const parsed = JSON.parse(stdout)
  return Array.isArray(parsed) ? parsed : []
}

function queryRows(options, command) {
  const result = runD1Json(options, command)
  const first = result[0] || {}
  return Array.isArray(first.results) ? first.results : []
}

function execStatements(options, statements) {
  const sql = statements.filter(Boolean).join('\n')
  if (!sql.trim()) return
  if (options.verbose || options.dryRun) {
    console.log('\n--- SQL batch ---\n' + sql + '\n--- end batch ---')
  }
  if (options.dryRun) return
  runD1Json(options, sql)
}

function ensureRequiredTables(options) {
  const rows = queryRows(
    options,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (
      'users',
      'user_identities',
      'organization_memberships',
      'company_memberships'
    ) ORDER BY name`
  )

  const names = new Set(rows.map((row) => String(row.name || '').trim()))
  const missing = ['users', 'user_identities', 'organization_memberships', 'company_memberships']
    .filter((name) => !names.has(name))

  if (missing.length) {
    throw new Error(
      `Missing auth tables: ${missing.join(', ')}. Apply the schema migration before running this backfill.`
    )
  }
}

function loadCompanyBootstrapRows(options) {
  return queryRows(
    options,
    `WITH ranked_signups AS (
      SELECT
        ps.company_id,
        ps.organization_id,
        ps.owner_email,
        ps.restaurant_name,
        ps.created_at,
        ROW_NUMBER() OVER (
          PARTITION BY ps.company_id
          ORDER BY ps.created_at DESC, ps.id DESC
        ) AS signup_rank
      FROM platform_signups ps
      WHERE ps.company_id IS NOT NULL
    )
    SELECT
      c.id AS company_id,
      c.organization_id AS company_organization_id,
      c.name AS company_name,
      c.email AS company_email,
      c.created_at AS company_created_at,
      o.name AS organization_name,
      o.billing_email AS organization_billing_email,
      rs.organization_id AS signup_organization_id,
      rs.owner_email AS signup_owner_email,
      rs.restaurant_name AS signup_restaurant_name,
      rs.created_at AS signup_created_at
    FROM companies c
    LEFT JOIN organizations o ON o.id = c.organization_id
    LEFT JOIN ranked_signups rs ON rs.company_id = c.id AND rs.signup_rank = 1
    WHERE COALESCE(c.is_active, 1) = 1
    ORDER BY c.id`
  )
}

function chooseBootstrapEmail(row) {
  return normalizeEmail(
    cleanText(row.signup_owner_email)
      || cleanText(row.company_email)
      || cleanText(row.organization_billing_email)
      || ''
  )
}

function chooseDisplayName(row) {
  const restaurantName = cleanText(row.signup_restaurant_name) || cleanText(row.company_name)
  if (restaurantName) return `${restaurantName} Owner`
  const email = chooseBootstrapEmail(row)
  if (!email) return 'Restaurant Owner'
  return email.split('@')[0]
}

function loadExistingUsers(options) {
  const rows = queryRows(options, 'SELECT id, primary_email_normalized FROM users')
  return new Map(rows.map((row) => [normalizeEmail(row.primary_email_normalized), String(row.id || '').trim()]))
}

function loadExistingMembershipSet(options, tableName, scopeColumn) {
  const rows = queryRows(options, `SELECT ${scopeColumn}, user_id, role FROM ${tableName}`)
  return new Set(
    rows.map((row) => `${String(row[scopeColumn] || '').trim()}::${String(row.user_id || '').trim()}::${String(row.role || '').trim()}`)
  )
}

function buildUserStatements(userId, normalizedEmail, displayName, createdAt, bootstrapSource) {
  return [
    `INSERT OR IGNORE INTO users (
      id, primary_email, primary_email_normalized, display_name, status, created_at, updated_at
    ) VALUES (
      ${sqlString(userId)},
      ${sqlString(normalizedEmail)},
      ${sqlString(normalizedEmail)},
      ${sqlString(displayName)},
      'active',
      ${sqlString(createdAt)},
      ${sqlString(createdAt)}
    );`,
    `UPDATE users
      SET primary_email = ${sqlString(normalizedEmail)},
          primary_email_normalized = ${sqlString(normalizedEmail)},
          display_name = COALESCE(NULLIF(display_name, ''), ${sqlString(displayName)}),
          updated_at = ${sqlString(createdAt)}
      WHERE id = ${sqlString(userId)};`,
    `INSERT OR IGNORE INTO user_identities (
      id, user_id, provider, provider_subject, email, email_normalized, is_primary, verified_at,
      metadata_json, created_at, updated_at
    ) VALUES (
      ${sqlString(buildStableId('ident_email_', normalizedEmail, 20))},
      ${sqlString(userId)},
      'email_magic_link',
      NULL,
      ${sqlString(normalizedEmail)},
      ${sqlString(normalizedEmail)},
      1,
      ${sqlString(createdAt)},
      ${sqlString(JSON.stringify({ bootstrapSource }))},
      ${sqlString(createdAt)},
      ${sqlString(createdAt)}
    );`
  ]
}

function buildMembershipStatements(row, userId, createdAt) {
  const statements = []
  const organizationId = Number(row.company_organization_id || row.signup_organization_id || 0)
  const companyId = Number(row.company_id || 0)

  if (organizationId > 0) {
    statements.push(`INSERT OR IGNORE INTO organization_memberships (
      id, organization_id, user_id, role, status, created_at, updated_at, created_by
    ) VALUES (
      ${sqlString(`orgmem_${organizationId}_${userId.slice(-12)}`)},
      ${organizationId},
      ${sqlString(userId)},
      'organization_owner',
      'active',
      ${sqlString(createdAt)},
      ${sqlString(createdAt)},
      'identity_auth_backfill'
    );`)
  }

  if (companyId > 0) {
    statements.push(`INSERT OR IGNORE INTO company_memberships (
      id, company_id, user_id, role, status, source, created_at, updated_at, created_by
    ) VALUES (
      ${sqlString(`cmpmem_${companyId}_${userId.slice(-12)}`)},
      ${companyId},
      ${sqlString(userId)},
      'tenant_admin',
      'active',
      'signup_bootstrap',
      ${sqlString(createdAt)},
      ${sqlString(createdAt)},
      'identity_auth_backfill'
    );`)
  }

  return statements
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const summary = {
    companiesSeen: 0,
    companiesSeeded: 0,
    companiesSkippedNoEmail: 0,
    usersCreated: 0,
    usersReused: 0,
    organizationMembershipsCreated: 0,
    companyMembershipsCreated: 0
  }

  ensureRequiredTables(options)

  const companyRows = loadCompanyBootstrapRows(options)
  const existingUsers = loadExistingUsers(options)
  const existingOrgMemberships = loadExistingMembershipSet(options, 'organization_memberships', 'organization_id')
  const existingCompanyMemberships = loadExistingMembershipSet(options, 'company_memberships', 'company_id')

  for (const row of companyRows) {
    summary.companiesSeen += 1
    const normalizedEmail = chooseBootstrapEmail(row)

    if (!normalizedEmail) {
      summary.companiesSkippedNoEmail += 1
      if (options.verbose) {
        console.warn(`Skipping company ${row.company_id}: no bootstrap email available`)
      }
      continue
    }

    const userId = existingUsers.get(normalizedEmail) || buildStableId('user_', normalizedEmail, 24)
    const createdAt = cleanText(row.signup_created_at) || cleanText(row.company_created_at) || new Date().toISOString()
    const displayName = chooseDisplayName(row)
    const bootstrapSource = cleanText(row.signup_owner_email)
      ? 'platform_signups.owner_email'
      : cleanText(row.company_email)
        ? 'companies.email'
        : 'organizations.billing_email'

    if (existingUsers.has(normalizedEmail)) {
      summary.usersReused += 1
    } else {
      existingUsers.set(normalizedEmail, userId)
      summary.usersCreated += 1
    }

    const statements = [
      ...buildUserStatements(userId, normalizedEmail, displayName, createdAt, bootstrapSource),
      ...buildMembershipStatements(row, userId, createdAt)
    ]

    const organizationId = Number(row.company_organization_id || row.signup_organization_id || 0)
    if (organizationId > 0) {
      const orgMembershipKey = `${organizationId}::${userId}::organization_owner`
      if (!existingOrgMemberships.has(orgMembershipKey)) {
        existingOrgMemberships.add(orgMembershipKey)
        summary.organizationMembershipsCreated += 1
      }
    }

    const companyId = Number(row.company_id || 0)
    if (companyId > 0) {
      const companyMembershipKey = `${companyId}::${userId}::tenant_admin`
      if (!existingCompanyMemberships.has(companyMembershipKey)) {
        existingCompanyMemberships.add(companyMembershipKey)
        summary.companyMembershipsCreated += 1
      }
    }

    execStatements(options, statements)
    summary.companiesSeeded += 1
  }

  console.log('\nIdentity auth backfill summary:')
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Mode: ${options.dryRun ? 'dry-run' : 'apply'}${options.remote ? ' (remote)' : ''}${options.env ? ` env=${options.env}` : ''}`)
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exitCode = 1
}
