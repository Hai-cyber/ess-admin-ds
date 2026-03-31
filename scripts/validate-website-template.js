#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SUPPORTED_THEMES = new Set([
  'theme-basic-a',
  'theme-basic-b',
  'theme-luxury-a',
  'theme-luxury-b',
  'theme-minimal-a',
  'theme-minimal-b',
  'theme-diner-a',
  'theme-diner-b'
]);

const SUPPORTED_TIERS = new Set(['basic', 'plus', 'premium']);
const FIXED_PAGES = ['home', 'menu', 'shop', 'reservation', 'about', 'contact', 'career', 'founder'];
const FIXED_PAGE_SET = new Set(FIXED_PAGES);
const SECTION_COPY_KEYS = new Set([
  'homeSignatures',
  'menu',
  'shop',
  'menuCategories',
  'reservation',
  'contact',
  'marketFit'
]);

const defaultFiles = [
  'public/website-master/tenant-source.example.json'
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isBoolean(value) {
  return typeof value === 'boolean';
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isUrlLike(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }
  if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function pushIssue(bucket, level, field, message) {
  bucket.push({ level, field, message });
}

function validateRequiredObject(data, key, errors) {
  if (!isObject(data[key])) {
    pushIssue(errors, 'error', key, 'Missing required object.');
    return false;
  }
  return true;
}

function validateStringField(source, fieldPath, errors, warnings, options = {}) {
  const { required = false, allowEmpty = false, urlLike = false } = options;
  const parts = fieldPath.split('.');
  let value = source;
  for (const part of parts) {
    value = value?.[part];
  }

  if (value == null) {
    if (required) {
      pushIssue(errors, 'error', fieldPath, 'Missing required field.');
    }
    return;
  }

  if (typeof value !== 'string') {
    pushIssue(errors, 'error', fieldPath, 'Expected string value.');
    return;
  }

  if (!allowEmpty && value.trim() === '') {
    if (required) {
      pushIssue(errors, 'error', fieldPath, 'Field must not be empty.');
    } else {
      pushIssue(warnings, 'warning', fieldPath, 'Field is empty and will rely on fallback behavior.');
    }
  }

  if (urlLike && value.trim() !== '' && !isUrlLike(value)) {
    pushIssue(errors, 'error', fieldPath, 'Expected an absolute URL or asset-relative path.');
  }
}

function validateArrayItems(arrayValue, fieldPath, errors, validator) {
  if (arrayValue == null) {
    return;
  }
  if (!Array.isArray(arrayValue)) {
    pushIssue(errors, 'error', fieldPath, 'Expected array.');
    return;
  }
  arrayValue.forEach((item, index) => validator(item, `${fieldPath}[${index}]`, errors));
}

function validatePayload(data, filePath) {
  const errors = [];
  const warnings = [];

  if (!isObject(data)) {
    pushIssue(errors, 'error', 'root', 'Top-level JSON must be an object.');
    return { filePath, errors, warnings };
  }

  if (data.contract_version && data.contract_version !== 'website-template-v1') {
    pushIssue(warnings, 'warning', 'contract_version', 'Expected contract_version to be website-template-v1.');
  }

  const requiredObjects = ['tenant', 'company', 'settings', 'navigation', 'modules', 'content'];
  for (const key of requiredObjects) {
    validateRequiredObject(data, key, errors);
  }

  if (isObject(data.tenant)) {
    validateStringField(data, 'tenant.id', errors, warnings, { required: true });
    if (data.tenant.company_id == null || !['number', 'string'].includes(typeof data.tenant.company_id)) {
      pushIssue(errors, 'error', 'tenant.company_id', 'Expected numeric or string company reference.');
    }
    validateStringField(data, 'tenant.theme', errors, warnings, { required: true });
    if (isNonEmptyString(data.tenant.theme) && !SUPPORTED_THEMES.has(data.tenant.theme)) {
      pushIssue(errors, 'error', 'tenant.theme', 'Unsupported theme key.');
    }
    validateStringField(data, 'tenant.tier', errors, warnings, { required: true });
    if (isNonEmptyString(data.tenant.tier) && !SUPPORTED_TIERS.has(data.tenant.tier)) {
      pushIssue(errors, 'error', 'tenant.tier', 'Unsupported tier value.');
    }
    validateStringField(data, 'tenant.content_preset', errors, warnings, { required: true });
  }

  if (isObject(data.company)) {
    ['name', 'city', 'cuisine', 'phone', 'email', 'address'].forEach((field) => {
      validateStringField(data, `company.${field}`, errors, warnings, { required: true });
    });
  }

  if (isObject(data.settings)) {
    [
      'site_hero_title',
      'site_hero_subtitle',
      'site_about_title',
      'site_about_body',
      'site_primary_cta_text',
      'site_secondary_cta_text',
      'booking_email'
    ].forEach((field) => {
      validateStringField(data, `settings.${field}`, errors, warnings, { required: true });
    });
  }

  if (isObject(data.appearance)) {
    if ('background_image' in data.appearance) {
      validateStringField(data, 'appearance.background_image', errors, warnings, { urlLike: true });
    }
    if ('background_color' in data.appearance && !isNonEmptyString(data.appearance.background_color)) {
      pushIssue(errors, 'error', 'appearance.background_color', 'Expected non-empty color string.');
    }
    if ('background_focal_point' in data.appearance && !isNonEmptyString(data.appearance.background_focal_point)) {
      pushIssue(errors, 'error', 'appearance.background_focal_point', 'Expected non-empty focal point string.');
    }
    if ('background_brightness' in data.appearance) {
      if (!isFiniteNumber(data.appearance.background_brightness)) {
        pushIssue(errors, 'error', 'appearance.background_brightness', 'Expected numeric brightness value.');
      } else if (data.appearance.background_brightness < 0 || data.appearance.background_brightness > 100) {
        pushIssue(errors, 'error', 'appearance.background_brightness', 'Brightness must be between 0 and 100.');
      }
    }
    if ('background_overlay_opacity' in data.appearance) {
      if (!isFiniteNumber(data.appearance.background_overlay_opacity)) {
        pushIssue(errors, 'error', 'appearance.background_overlay_opacity', 'Expected numeric overlay opacity value.');
      } else if (data.appearance.background_overlay_opacity < 0 || data.appearance.background_overlay_opacity > 100) {
        pushIssue(errors, 'error', 'appearance.background_overlay_opacity', 'Overlay opacity must be between 0 and 100.');
      }
    }
  }

  if (isObject(data.navigation)) {
    if (!isObject(data.navigation.labels)) {
      pushIssue(errors, 'error', 'navigation.labels', 'Missing navigation labels object.');
    } else {
      for (const page of FIXED_PAGES) {
        validateStringField(data, `navigation.labels.${page}`, errors, warnings, { required: true });
      }
      Object.keys(data.navigation.labels).forEach((key) => {
        if (!FIXED_PAGE_SET.has(key)) {
          pushIssue(errors, 'error', `navigation.labels.${key}`, 'Unknown page key is not allowed.');
        }
      });
    }

    if (!isObject(data.navigation.page_visibility)) {
      pushIssue(errors, 'error', 'navigation.page_visibility', 'Missing page visibility object.');
    } else {
      for (const page of FIXED_PAGES) {
        const value = data.navigation.page_visibility[page];
        if (!isObject(value)) {
          pushIssue(errors, 'error', `navigation.page_visibility.${page}`, 'Missing page visibility entry.');
          continue;
        }
        if (!isBoolean(value.show_in_nav)) {
          pushIssue(errors, 'error', `navigation.page_visibility.${page}.show_in_nav`, 'Expected boolean.');
        }
        if (!isBoolean(value.show_on_home)) {
          pushIssue(errors, 'error', `navigation.page_visibility.${page}.show_on_home`, 'Expected boolean.');
        }
      }
      Object.keys(data.navigation.page_visibility).forEach((key) => {
        if (!FIXED_PAGE_SET.has(key)) {
          pushIssue(errors, 'error', `navigation.page_visibility.${key}`, 'Unknown page key is not allowed.');
        }
      });
    }

    validateArrayItems(data.navigation.secondary_items, 'navigation.secondary_items', errors, (item, itemPath, itemErrors) => {
      if (!isObject(item)) {
        pushIssue(itemErrors, 'error', itemPath, 'Expected object.');
        return;
      }
      if (!isNonEmptyString(item.label)) {
        pushIssue(itemErrors, 'error', `${itemPath}.label`, 'Missing label.');
      }
      const hasPage = isNonEmptyString(item.page);
      const hasHref = isNonEmptyString(item.href);
      if (!hasPage && !hasHref) {
        pushIssue(itemErrors, 'error', itemPath, 'Expected either page or href.');
      }
      if (hasPage && !FIXED_PAGE_SET.has(item.page)) {
        pushIssue(itemErrors, 'error', `${itemPath}.page`, 'Unknown page key is not allowed.');
      }
      if (hasHref && !isUrlLike(item.href)) {
        pushIssue(itemErrors, 'error', `${itemPath}.href`, 'Expected an absolute URL or asset-relative path.');
      }
    });
  }

  if (isObject(data.content)) {
    ['hero_image', 'journal_feature_image', 'team_image'].forEach((field) => {
      if (field in data.content) {
        validateStringField(data, `content.${field}`, errors, warnings, { urlLike: true });
      }
    });

    validateArrayItems(data.content.story_paragraphs, 'content.story_paragraphs', errors, (item, itemPath, itemErrors) => {
      if (!isNonEmptyString(item)) {
        pushIssue(itemErrors, 'error', itemPath, 'Expected non-empty paragraph string.');
      }
    });

    validateArrayItems(data.content.signature_items, 'content.signature_items', errors, (item, itemPath, itemErrors) => {
      if (!isObject(item)) {
        pushIssue(itemErrors, 'error', itemPath, 'Expected object.');
        return;
      }
      ['name', 'price', 'description'].forEach((field) => {
        if (!isNonEmptyString(item[field])) {
          pushIssue(itemErrors, 'error', `${itemPath}.${field}`, 'Expected non-empty string.');
        }
      });
      if ('image' in item && item.image !== '' && !isUrlLike(item.image)) {
        pushIssue(itemErrors, 'error', `${itemPath}.image`, 'Expected an absolute URL or asset-relative path.');
      }
    });

    ['location_cards', 'journal_cards', 'menu_link_cards'].forEach((arrayField) => {
      validateArrayItems(data.content[arrayField], `content.${arrayField}`, errors, (item, itemPath, itemErrors) => {
        if (!isObject(item)) {
          pushIssue(itemErrors, 'error', itemPath, 'Expected object.');
          return;
        }
        ['title', 'body'].forEach((field) => {
          if (!isNonEmptyString(item[field])) {
            pushIssue(itemErrors, 'error', `${itemPath}.${field}`, 'Expected non-empty string.');
          }
        });
        if ('image' in item && item.image !== '' && !isUrlLike(item.image)) {
          pushIssue(itemErrors, 'error', `${itemPath}.image`, 'Expected an absolute URL or asset-relative path.');
        }
      });
    });

    validateArrayItems(data.content.menu_sections, 'content.menu_sections', errors, (item, itemPath, itemErrors) => {
      if (!isObject(item)) {
        pushIssue(itemErrors, 'error', itemPath, 'Expected object.');
        return;
      }
      ['label', 'title'].forEach((field) => {
        if (!isNonEmptyString(item[field])) {
          pushIssue(itemErrors, 'error', `${itemPath}.${field}`, 'Expected non-empty string.');
        }
      });
      validateArrayItems(item.items, `${itemPath}.items`, itemErrors, (menuItem, menuItemPath, nestedErrors) => {
        if (!isObject(menuItem)) {
          pushIssue(nestedErrors, 'error', menuItemPath, 'Expected object.');
          return;
        }
        ['name', 'description', 'price'].forEach((field) => {
          if (!isNonEmptyString(menuItem[field])) {
            pushIssue(nestedErrors, 'error', `${menuItemPath}.${field}`, 'Expected non-empty string.');
          }
        });
      });
    });

    validateArrayItems(data.content.category_cards, 'content.category_cards', errors, (item, itemPath, itemErrors) => {
      if (!isObject(item)) {
        pushIssue(itemErrors, 'error', itemPath, 'Expected object.');
        return;
      }
      ['label', 'title', 'body'].forEach((field) => {
        if (!isNonEmptyString(item[field])) {
          pushIssue(itemErrors, 'error', `${itemPath}.${field}`, 'Expected non-empty string.');
        }
      });
    });

    if ('section_copy' in data.content) {
      if (!isObject(data.content.section_copy)) {
        pushIssue(errors, 'error', 'content.section_copy', 'Expected object.');
      } else {
        Object.keys(data.content.section_copy).forEach((key) => {
          if (!SECTION_COPY_KEYS.has(key)) {
            pushIssue(errors, 'error', `content.section_copy.${key}`, 'Unknown section key is not allowed.');
            return;
          }
          const section = data.content.section_copy[key];
          if (!isObject(section)) {
            pushIssue(errors, 'error', `content.section_copy.${key}`, 'Expected object.');
            return;
          }
          ['eyebrow', 'title', 'body'].forEach((field) => {
            if (field in section && typeof section[field] !== 'string') {
              pushIssue(errors, 'error', `content.section_copy.${key}.${field}`, 'Expected string value.');
            }
          });
        });
      }
    }
  }

  if (isObject(data.modules) && data.tenant?.tier === 'basic' && data.modules.module_membership_management) {
    pushIssue(warnings, 'warning', 'modules.module_membership_management', 'Basic tier enables membership module; founder UI will still be gated by tier.');
  }

  return { filePath, errors, warnings };
}

function main() {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : defaultFiles;
  const results = [];

  for (const target of targets) {
    const resolvedPath = path.resolve(process.cwd(), target);
    let raw;
    let parsed;
    try {
      raw = fs.readFileSync(resolvedPath, 'utf8');
    } catch (error) {
      results.push({
        filePath: target,
        errors: [{ level: 'error', field: 'file', message: `Unable to read file: ${error.message}` }],
        warnings: []
      });
      continue;
    }
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      results.push({
        filePath: target,
        errors: [{ level: 'error', field: 'json', message: `Invalid JSON: ${error.message}` }],
        warnings: []
      });
      continue;
    }
    results.push(validatePayload(parsed, target));
  }

  let hasErrors = false;
  for (const result of results) {
    console.log(`\n[website-template-validator] ${result.filePath}`);
    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log('  OK');
      continue;
    }
    for (const warning of result.warnings) {
      console.log(`  WARN  ${warning.field} - ${warning.message}`);
    }
    for (const error of result.errors) {
      hasErrors = true;
      console.log(`  ERROR ${error.field} - ${error.message}`);
    }
  }

  if (hasErrors) {
    process.exit(1);
  }
}

main();