/* =====================================================
   Restaurant OS — Platform Site JS
   i18n (EN/DE/VI) + shared nav/footer + signup wizard
   ===================================================== */

// ── Language system ──────────────────────────────────

function normalizeRosLang(lang) {
  if (!lang || typeof lang !== 'string') return null;
  const normalized = lang.toLowerCase();
  if (normalized.startsWith('de')) return 'de';
  if (normalized.startsWith('vi')) return 'vi';
  if (normalized.startsWith('en')) return 'en';
  return null;
}

function getStoredRosLang() {
  try {
    return normalizeRosLang(localStorage.getItem('ros-lang'));
  } catch {
    return null;
  }
}

function getBrowserRosLang() {
  if (typeof navigator === 'undefined') return 'en';
  const browserLangs = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language, navigator.userLanguage, navigator.browserLanguage];
  for (const lang of browserLangs) {
    const resolved = normalizeRosLang(lang);
    if (resolved) return resolved;
  }
  return 'en';
}

function getPreferredRosLang() {
  return getStoredRosLang() || getBrowserRosLang();
}

let ROS_LANG = getPreferredRosLang();
window.getPreferredRosLang = getPreferredRosLang;

const T = {
  en: {
    // Nav
    'nav.features':       'Features',
    'nav.pricing':        'Pricing',
    'nav.contact':        'Contact',
    'nav.login':          'Log in',
    'nav.signup':         'Start free trial',
    'log.title':          'Choose your login surface',
    'log.subtitle':       'Restaurant OS uses different entry points for platform operators, tenant admins, and staff. Pick the right surface first, then continue with your PIN on the next screen.',
    'log.role_platform':  'Platform operator',
    'log.role_platform_desc': 'Pricing, signups, and operator console',
    'log.role_tenant':    'Restaurant admin',
    'log.role_tenant_desc': 'Company settings, staff, and integrations',
    'log.role_board':     'Booking board',
    'log.role_board_desc': 'Front-of-house live board and staff PIN access',
    'log.ctx_platform_title': 'Open the platform operator console',
    'log.ctx_platform_desc': 'Use this if you manage SaaS pricing, inbound signups, and operator follow-up.',
    'log.ctx_tenant_title': 'Open the tenant admin console',
    'log.ctx_tenant_desc': 'Use this for restaurant-level setup, staff management, website settings, and operational configuration.',
    'log.ctx_board_title': 'Open the booking board',
    'log.ctx_board_desc': 'Use this for host stand operations, live bookings, and staff-side actions during service.',
    'log.company_label':  'Company ID',
    'log.company_hint':   'Required on localhost and workers.dev preview hosts.',
    'log.slug_label':     'Workspace subdomain',
    'log.slug_hint':      'Optional in single-domain mode. Example: esskultur-main',
    'log.local_note':     'Local preview needs company_id to resolve the tenant context.',
    'log.remote_note':    'If your tenant uses a subdomain, enter it here. Otherwise the current host will be used.',
    'log.platform_note':  'Platform operator access does not need tenant context. You will enter the operator PIN on the next screen.',
    'log.continue_platform': 'Continue to platform admin',
    'log.continue_tenant': 'Continue to restaurant admin',
    'log.continue_board': 'Continue to booking board',
    'log.cancel':         'Cancel',
    'log.err_company':    'Enter a valid company ID to continue on this host.',

    // Hero
    'hero.badge':         '🍽️ Restaurant OS — Built for modern restaurants',
    'hero.title':         'Run your restaurant,\nnot your software',
    'hero.subtitle':      'From online bookings to staff operations to your own website — everything your restaurant needs in one system.',
    'hero.cta1':          'Start free 14-day trial',
    'hero.cta2':          'See pricing',
    'hero.m1':            'No credit card required',
    'hero.m2':            'Setup in under 1 hour',
    'hero.m3':            'Cancel anytime',

    // Features
    'feat.tag':           'Everything you need',
    'feat.h2':            'Built for how restaurants actually work',
    'feat.sub':           'Not an ERP. Not a generic platform. Purpose-built for daily restaurant operations.',
    'feat.booking.title': 'Online & onsite bookings',
    'feat.booking.desc':  'Guests book online. Staff create walk-ins. Both flow into the same real-time board with zero delay.',
    'feat.board.title':   'Live booking board',
    'feat.board.desc':    'See today\'s bookings at a glance. Confirm, seat, and close — all from one screen, in real-time.',
    'feat.stages.title':  'Stage management',
    'feat.stages.desc':   'Pending → Confirmed → Arrived → Done. Move guests through the flow with a single tap.',
    'feat.website.title': 'Your restaurant website',
    'feat.website.desc':  'Professional website at your own subdomain. Menu, booking form, contact info — ready in minutes.',
    'feat.staff.title':   'Staff PIN app',
    'feat.staff.desc':    'No accounts to manage. Staff log in with a 4-digit PIN. Works on any phone, no install needed.',
    'feat.crm.title':     'Guest CRM',
    'feat.crm.desc':      'Guest profiles, booking history, notes, and tags. All first-party in your own database — no external CRM needed.',
    'feat.crm.phase':     'Phase 4',

    // Pricing
    'price.tag':          'Pricing',
    'price.h2':           'Simple, transparent pricing',
    'price.sub':          'Pay per active user. Choose the operating result your restaurant needs.',
    'price.core_name':    'Online',
    'price.com_name':     'Service',
    'price.grow_name':    'Repeat Guests',
    'price.ent_name':     'Groups',
    'price.popular':      'Most popular',
    'price.cta':          'Start free trial',
    'price.cta_ent':      'Contact us',
    'price.core_desc':    'For restaurants that need a branded website on a managed subdomain.',
    'price.com_desc':     'For restaurants that need POS, service flow, and a German-standard checkout.',
    'price.grow_desc':    'For restaurants that want SMS marketing and loyal-guest management built in.',
    'price.ent_desc':     'Multi-location, custom integrations, dedicated SLA support.',
    'price.core_f1':      'Restaurant website',
    'price.core_f2':      'Hosted on your gooddining.app subdomain',
    'price.core_f3':      'Contact and info page',
    'price.core_f4':      'No booking workflow included',
    'price.core_f5':      'Hosting included',
    'price.core_f6':      'SSL included',
    'price.com_f1':       'Everything in Online',
    'price.com_f2':       'Restaurant POS',
    'price.com_f3':       'Live booking board, reminders, and confirmations',
    'price.com_f4':       'Fast staff PIN login and walk-ins',
    'price.com_f5':       'German-standard cash register workflow',
    'price.com_f6':       'TSE available as add-on for German compliance',
    'price.grow_f1':      'Everything in Service',
    'price.grow_f2':      'SMS marketing for previous guests',
    'price.grow_f3':      'Loyal guest profiles and segments',
    'price.grow_f4':      'Simple win-back campaigns',
    'price.grow_f5':      'Repeat-guest overview and follow-up',
    'price.ent_f1':       'Everything in Repeat Guests',
    'price.ent_f2':       'Multi-location support',
    'price.ent_f3':       'Custom integrations API',
    'price.ent_f4':       'Dedicated onboarding + SLA',
    'price.per_mo':       '/active user/mo',
    'price.custom':       'Custom',
    'price.extras_title': 'Included vs add-ons',
    'price.included_title': 'Included in every plan',
    'price.included_body': 'Hosting, platform maintenance, SSL, and a managed gooddining.app subdomain.',
    'price.setup_title':  'One-time onboarding',
    'price.sms_title':    'SMS delivery',
    'price.tse_title':    'German fiscal compliance',
    'price.support_title': 'IT support',
    'price.note':         'Billed per active user. Included: hosting, platform maintenance, SSL, and a managed gooddining.app subdomain. Add-ons only apply for SMS usage, TSE, onboarding, and optional IT support.',
    'price.setup_value':  '{amount} one-time setup',
    'price.sms_value':    'Usage-based, only if you send SMS reminders or campaigns.',
    'price.tse_value':    '{amount}/month TSE package',
    'price.support_value': '{hourly}/hour IT support or {monthly}/month retainer',

    // Footer
    'footer.tagline':     'Restaurant OS — purpose-built for modern restaurant operations. Real-time and built for multi-tenant operations.',
    'footer.product':     'Product',
    'footer.legal':       'Legal',
    'footer.support':     'Support',
    'footer.features':    'Features',
    'footer.pricing':     'Pricing',
    'footer.contact':     'Contact',
    'footer.terms':       'Terms & Conditions',
    'footer.privacy':     'Privacy Policy',
    'footer.impressum':   'Impressum',
    'footer.docs':        'Documentation',
    'footer.status':      'System status',
    'footer.copyright':   '© 2026 Restaurant OS. All rights reserved.',

    // Signup
    'su.title':           'Create your account',
    'su.subtitle':        '14-day free trial. No credit card required.',
    'su.s1':              'Plan',
    'su.s2':              'Restaurant',
    'su.s3':              'Account',
    'su.s4':              'Done',
    'su.back':            'Back',
    'su.next':            'Continue',
    'su.submit':          'Create account',
    'su.plan_label':      'Choose your plan',
    'su.name_label':      'Restaurant name',
    'su.name_ph':         'e.g. Trattoria Roma',
    'su.addr_label':      'Address',
    'su.addr_ph':         'Street, city',
    'su.country_label':   'Country',
    'su.email_label':     'Owner email',
    'su.email_ph':        'you@yourrestaurant.com',
    'su.phone_label':     'Phone (optional)',
    'su.sub_label':       'Your gooddining.app subdomain',
    'su.sub_hint':        'Guests see this URL on your website. Lowercase letters, numbers, and hyphens only.',
    'su.sub_checking':    'Checking availability…',
    'su.sub_ok':          '✓ Available',
    'su.sub_taken':       '✗ Already taken — try another',
    'su.pass_label':      'Password',
    'su.pass_hint':       'Minimum 8 characters.',
    'su.agree_pre':       'I agree to the',
    'su.agree_terms':     'Terms & Conditions',
    'su.agree_and':       'and',
    'su.agree_priv':      'Privacy Policy',
    'su.ok_title':        'Check your email!',
    'su.ok_body':         'We sent a verification link to <strong>{email}</strong>. Click it to activate your account and open your setup wizard.',
    'su.ok_note':         'The link expires in 24 hours. Check your spam folder if you don\'t see it within a few minutes.',
    'su.ent_note':        'For Enterprise plans, contact us directly.',
    'su.ent_link':        'Contact sales →',
    'su.plan_hint':       'Recommended left to right',
    'su.plan_core_f1':    'Restaurant website on your gooddining.app subdomain',
    'su.plan_core_f2':    'Contact page, opening hours, and essential info',
    'su.plan_core_f3':    'Hosting and SSL included. No booking workflow',
    'su.plan_com_f1':     'Everything in Online, plus restaurant POS',
    'su.plan_com_f2':     'Booking board, reminders, walk-ins, and staff PIN login',
    'su.plan_com_f3':     'German-standard cash register flow, with TSE as add-on',
    'su.plan_grow_f1':    'Everything in Service, plus SMS marketing',
    'su.plan_grow_f2':    'Loyal guest segments, return offers, and follow-up',
    'su.plan_grow_f3':    'Built for restaurants that want more repeat guests',
    'su.plan_ent_f1':     'Everything in Repeat Guests, plus multi-site rollout',
    'su.plan_ent_f2':     'Dedicated onboarding and SLA discussions',
    'su.plan_ent_f3':     'Manual pricing and integration scoping',
    'su.side_title':      'Workspace configuration',
    'su.side_live':       'Live preview',
    'su.initial_title':   'Initial setup',
    'su.users_label':     'Expected active users',
    'su.users_hint':      'Used for recurring billing and staffing assumptions.',
    'su.options_title':   'Demo invoice options',
    'su.pay_method_label': 'Demo payment method',
    'su.pay_method_hint': 'Choose how this demo onboarding payment should be marked for the tenant account.',
    'su.pay_method_bankcard': 'Bank card',
    'su.pay_method_paypal': 'PayPal',
    'su.pay_method_cash': 'Cash',
    'su.pay_method_pickup': 'Pick up at store',
    'su.extra_setup':     'Include one-time setup package for onboarding, import, and go-live preparation.',
    'su.extra_tse':       'Include TSE package for German fiscal compliance needs.',
    'su.extra_support':   'Include monthly IT support retainer for hands-on operational support.',
    'su.options_hint':    'Hosting, platform maintenance, SSL, and a managed gooddining.app subdomain are already included. SMS usage is billed separately only when you use it.',
    'su.commercial_title': 'Commercial summary',
    'su.summary_trial_label': 'Trial',
    'su.summary_launch_label': 'Launch mode',
    'su.summary_activation_label': 'Activation style',
    'su.summary_trial_value': '14 days',
    'su.summary_launch_value': 'Demo paid',
    'su.summary_activation_value': 'Admin + board preview',
    'su.footer_note':     'Need a custom rollout with multiple sites, migration planning, or a German compliance review first? <a href="/platform/contact.html">Talk to sales</a>.',
    'su.continue_cta':    'Continue to account setup',
    'su.summary_demo_title': 'Demo payment review',
    'su.summary_plan_label': 'Plan',
    'su.summary_users_label': 'Active users',
    'su.summary_included_label': 'Included',
    'su.summary_included_value': 'Hosting + SSL + managed subdomain',
    'su.summary_sms_label': 'SMS usage',
    'su.summary_sms_value': 'Billed separately if used',
    'su.summary_monthly_label': 'Recurring monthly estimate',
    'su.summary_today_label': 'Due today in demo mode',
    'su.summary_enterprise': 'Enterprise pricing is handled manually via contact.',

    // Contact
    'ct.title':           'Contact us',
    'ct.subtitle':        'Questions about pricing, demo requests, or support — send us a message.',
    'ct.name':            'Your name',
    'ct.email':           'Email',
    'ct.subject':         'Subject',
    'ct.message':         'Message',
    'ct.send':            'Send message',
    'ct.success':         'Thank you! We\'ll get back to you within 24 hours.',
    'ct.direct':          'Or email us directly:',
    'ct.side_title':      'How can we help?',
    'ct.side_desc':       'We respond within 24 hours on business days.',
    'ct.email_val':       'hello@restaurantos.app',
    'ct.location':        'Berlin, Germany',
  },

  de: {
    'nav.features':       'Funktionen',
    'nav.pricing':        'Preise',
    'nav.contact':        'Kontakt',
    'nav.login':          'Anmelden',
    'nav.signup':         'Kostenlos testen',
    'log.title':          'Anmeldebereich wählen',
    'log.subtitle':       'Restaurant OS hat unterschiedliche Einstiege für Plattform-Operatoren, Mandanten-Admins und Service-Mitarbeiter. Wähle zuerst den passenden Bereich und gib den PIN dann auf der nächsten Ansicht ein.',
    'log.role_platform':  'Plattform-Operator',
    'log.role_platform_desc': 'Preise, Signups und Operator-Konsole',
    'log.role_tenant':    'Restaurant-Admin',
    'log.role_tenant_desc': 'Firmeneinstellungen, Mitarbeiter und Integrationen',
    'log.role_board':     'Buchungsboard',
    'log.role_board_desc': 'Live-Board im Service und PIN-Zugang für Mitarbeiter',
    'log.ctx_platform_title': 'Plattform-Operator-Konsole öffnen',
    'log.ctx_platform_desc': 'Nutze diesen Einstieg für SaaS-Preise, eingehende Signups und Operator-Nachverfolgung.',
    'log.ctx_tenant_title': 'Mandanten-Admin-Konsole öffnen',
    'log.ctx_tenant_desc': 'Nutze diesen Einstieg für Restaurant-Setup, Mitarbeiterverwaltung, Website-Einstellungen und operative Konfiguration.',
    'log.ctx_board_title': 'Buchungsboard öffnen',
    'log.ctx_board_desc': 'Nutze diesen Einstieg für Host-Stand, Live-Buchungen und Service-Aktionen während des Betriebs.',
    'log.company_label':  'Company ID',
    'log.company_hint':   'Erforderlich auf localhost und workers.dev-Preview-Hosts.',
    'log.slug_label':     'Workspace-Subdomain',
    'log.slug_hint':      'Optional im Single-Domain-Modus. Beispiel: esskultur-main',
    'log.local_note':     'In der lokalen Vorschau wird company_id benötigt, um den Mandantenkontext aufzulösen.',
    'log.remote_note':    'Wenn dein Mandant eine Subdomain nutzt, trage sie hier ein. Andernfalls wird der aktuelle Host verwendet.',
    'log.platform_note':  'Der Zugang für Plattform-Operatoren braucht keinen Mandantenkontext. Den Operator-PIN gibst du auf der nächsten Ansicht ein.',
    'log.continue_platform': 'Weiter zur Plattform-Admin',
    'log.continue_tenant': 'Weiter zur Restaurant-Admin',
    'log.continue_board': 'Weiter zum Buchungsboard',
    'log.cancel':         'Abbrechen',
    'log.err_company':    'Gib eine gültige Company ID ein, um auf diesem Host fortzufahren.',

    'hero.badge':         '🍽️ Restaurant OS — Für moderne Restaurants',
    'hero.title':         'Führe dein Restaurant,\nnicht deine Software',
    'hero.subtitle':      'Von Online-Reservierungen über Service-Abläufe bis zur eigenen Website — alles, was Ihr Restaurant in einem System braucht.',
    'hero.cta1':          '14 Tage kostenlos testen',
    'hero.cta2':          'Preise ansehen',
    'hero.m1':            'Keine Kreditkarte erforderlich',
    'hero.m2':            'Einrichtung in unter 1 Stunde',
    'hero.m3':            'Jederzeit kündbar',

    'feat.tag':           'Alles was du brauchst',
    'feat.h2':            'Gebaut für den echten Restaurantalltag',
    'feat.sub':           'Kein ERP. Keine generische Plattform. Speziell für den täglichen Restaurantbetrieb.',
    'feat.booking.title': 'Online- & Vor-Ort-Buchungen',
    'feat.booking.desc':  'Gäste reservieren online. Mitarbeiter erstellen Walk-ins. Alles landet in einem Echtzeit-Board.',
    'feat.board.title':   'Live-Buchungsboard',
    'feat.board.desc':    'Tagesbuchungen auf einen Blick. Bestätigen, einweisen, abschließen — auf einem Bildschirm.',
    'feat.stages.title':  'Status-Management',
    'feat.stages.desc':   'Ausstehend → Bestätigt → Angekommen → Fertig. Gäste mit einem Tipp durch den Ablauf.',
    'feat.website.title': 'Deine Restaurant-Website',
    'feat.website.desc':  'Professionelle Website auf deiner eigenen Subdomain. Menü, Buchungsformular, Kontakt — in Minuten.',
    'feat.staff.title':   'Mitarbeiter-PIN-App',
    'feat.staff.desc':    'Kein Account-Management. Mitarbeiter melden sich mit Pin-Code an. Läuft auf jedem Smartphone.',
    'feat.crm.title':     'Gäste-CRM',
    'feat.crm.desc':      'Gastprofile, Buchungshistorie, Notizen und Tags. Alles intern in deiner Datenbank — kein externes CRM nötig.',
    'feat.crm.phase':     'Phase 4',

    'price.tag':          'Preise',
    'price.h2':           'Einfache, transparente Preise',
    'price.sub':          'Abrechnung pro aktivem Mitarbeiter, aber gekauft wird das Ergebnis. Hosting und Standard-Domain-Setup sind inklusive.',
    'price.core_name':    'Online',
    'price.com_name':     'Service',
    'price.grow_name':    'Stammgäste',
    'price.ent_name':     'Gruppen',
    'price.popular':      'Beliebteste Wahl',
    'price.cta':          'Kostenlos starten',
    'price.cta_ent':      'Kontaktieren',
    'price.core_desc':    'Für Restaurants, die eine gebrandete Website auf einer verwalteten Subdomain brauchen.',
    'price.com_desc':     'Für Restaurants, die POS, Service-Abläufe und Kassenstandard nach deutschem Standard brauchen.',
    'price.grow_desc':    'Für Restaurants, die SMS-Marketing und Stammgast-Management integriert haben wollen.',
    'price.ent_desc':     'Mehrere Standorte, individuelle Integrationen, dedizierter SLA-Support.',
    'price.core_f1':      'Restaurant-Website',
    'price.core_f2':      'Gehostet auf deiner gooddining.app-Subdomain',
    'price.core_f3':      'Kontakt- und Infoseite',
    'price.core_f4':      'Kein Reservierungs-Workflow enthalten',
    'price.core_f5':      'Hosting inklusive',
    'price.core_f6':      'SSL inklusive',
    'price.com_f1':       'Alles aus Online',
    'price.com_f2':       'Restaurant-POS',
    'price.com_f3':       'Live-Booking-Board, Erinnerungen und Bestätigungen',
    'price.com_f4':       'Schneller Mitarbeiter-PIN-Login und Walk-ins',
    'price.com_f5':       'Kassenablauf nach deutschem Standard',
    'price.com_f6':       'TSE als Add-on für deutsche Fiskal-Compliance',
    'price.grow_f1':      'Alles aus Service',
    'price.grow_f2':      'SMS-Marketing für frühere Gäste',
    'price.grow_f3':      'Stammgast-Profile und Segmente',
    'price.grow_f4':      'Einfache Win-back-Kampagnen',
    'price.grow_f5':      'Überblick und Nachverfolgung wiederkehrender Gäste',
    'price.ent_f1':       'Alles aus Stammgäste',
    'price.ent_f2':       'Multi-Standort-Unterstützung',
    'price.ent_f3':       'Individuelle Integrations-API',
    'price.ent_f4':       'Dediziertes Onboarding + SLA',
    'price.per_mo':       '/aktiver Nutzer/Monat',
    'price.custom':       'Individuell',
    'price.extras_title': 'Inklusive vs. Add-ons',
    'price.included_title': 'In jedem Paket enthalten',
    'price.included_body': 'Hosting, Plattform-Wartung, SSL und eine verwaltete gooddining.app-Subdomain.',
    'price.setup_title':  'Einmaliges Onboarding',
    'price.sms_title':    'SMS-Versand',
    'price.tse_title':    'Deutsche Fiskal-Compliance',
    'price.support_title': 'IT-Support',
    'price.note':         'Abrechnung pro aktivem Nutzer. Inklusive: Hosting, Plattform-Wartung, SSL und eine verwaltete gooddining.app-Subdomain. Add-ons fallen nur für SMS-Nutzung, TSE, Onboarding und optionalen IT-Support an.',
    'price.setup_value':  '{amount} einmaliges Setup',
    'price.sms_value':    'Nutzungsbasiert, nur wenn Sie SMS-Erinnerungen oder Kampagnen senden.',
    'price.tse_value':    '{amount}/Monat TSE-Paket',
    'price.support_value': '{hourly}/Stunde IT-Support oder {monthly}/Monat Retainer',

    'footer.tagline':     'Restaurant OS — speziell für den modernen Restaurantbetrieb. In Echtzeit und mandantenfähig aufgebaut.',
    'footer.product':     'Produkt',
    'footer.legal':       'Rechtliches',
    'footer.support':     'Support',
    'footer.features':    'Funktionen',
    'footer.pricing':     'Preise',
    'footer.contact':     'Kontakt',
    'footer.terms':       'AGB',
    'footer.privacy':     'Datenschutz',
    'footer.impressum':   'Impressum',
    'footer.docs':        'Dokumentation',
    'footer.status':      'Systemstatus',
    'footer.copyright':   '© 2026 Restaurant OS. Alle Rechte vorbehalten.',

    'su.title':           'Konto erstellen',
    'su.subtitle':        '14 Tage kostenlos. Keine Kreditkarte erforderlich.',
    'su.s1':              'Plan',
    'su.s2':              'Restaurant',
    'su.s3':              'Konto',
    'su.s4':              'Fertig',
    'su.back':            'Zurück',
    'su.next':            'Weiter',
    'su.submit':          'Konto erstellen',
    'su.plan_label':      'Plan auswählen',
    'su.name_label':      'Restaurantname',
    'su.name_ph':         'z. B. Trattoria Roma',
    'su.addr_label':      'Adresse',
    'su.addr_ph':         'Straße, Ort',
    'su.country_label':   'Land',
    'su.email_label':     'E-Mail des Inhabers',
    'su.email_ph':        'du@restaurant.de',
    'su.phone_label':     'Telefon (optional)',
    'su.sub_label':       'Deine gooddining.app-Subdomain',
    'su.sub_hint':        'Diese URL sehen deine Gäste auf deiner Website. Nur Kleinbuchstaben, Zahlen und Bindestriche.',
    'su.sub_checking':    'Wird geprüft…',
    'su.sub_ok':          '✓ Verfügbar',
    'su.sub_taken':       '✗ Bereits vergeben — anderen Namen versuchen',
    'su.pass_label':      'Passwort',
    'su.pass_hint':       'Mindestens 8 Zeichen.',
    'su.agree_pre':       'Ich stimme den',
    'su.agree_terms':     'AGB',
    'su.agree_and':       'und der',
    'su.agree_priv':      'Datenschutzerklärung',
    'su.ok_title':        'E-Mail prüfen!',
    'su.ok_body':         'Wir haben einen Bestätigungslink an <strong>{email}</strong> geschickt. Klicke darauf, um dein Konto zu aktivieren und zum Einrichtungsassistenten zu gelangen.',
    'su.ok_note':         'Der Link läuft nach 24 Stunden ab. Prüfe ggf. deinen Spam-Ordner.',
    'su.ent_note':        'Für Enterprise-Pläne bitte direkt kontaktieren.',
    'su.ent_link':        'Vertrieb kontaktieren →',
    'su.plan_hint':       'Von links nach rechts empfohlen',
    'su.plan_core_f1':    'Restaurant-Website auf deiner gooddining.app-Subdomain',
    'su.plan_core_f2':    'Kontaktseite, Öffnungszeiten und Basisinfos',
    'su.plan_core_f3':    'Hosting und SSL inklusive. Kein Reservierungs-Workflow',
    'su.plan_com_f1':     'Alles aus Online, plus Restaurant-POS',
    'su.plan_com_f2':     'Booking-Board, Erinnerungen, Walk-ins und Mitarbeiter-PIN-Login',
    'su.plan_com_f3':     'Kassenablauf nach deutschem Standard, TSE als Add-on',
    'su.plan_grow_f1':    'Alles aus Service, plus SMS-Marketing',
    'su.plan_grow_f2':    'Stammgast-Segmente, Rückkehr-Angebote und Nachverfolgung',
    'su.plan_grow_f3':    'Für Restaurants, die mehr wiederkehrende Gäste wollen',
    'su.plan_ent_f1':     'Alles aus Stammgäste, plus Multi-Standort-Rollout',
    'su.plan_ent_f2':     'Dediziertes Onboarding und SLA-Abstimmung',
    'su.plan_ent_f3':     'Manuelle Preis- und Integrationsplanung',
    'su.side_title':      'Workspace-Konfiguration',
    'su.side_live':       'Live-Vorschau',
    'su.initial_title':   'Ersteinrichtung',
    'su.users_label':     'Erwartete aktive Nutzer',
    'su.users_hint':      'Wird für laufende Abrechnung und Personalplanung verwendet.',
    'su.options_title':   'Demo-Rechnungsoptionen',
    'su.pay_method_label': 'Demo-Zahlungsart',
    'su.pay_method_hint': 'Wähle, wie diese Demo-Onboarding-Zahlung im Tenant-Konto markiert werden soll.',
    'su.pay_method_bankcard': 'Bankkarte',
    'su.pay_method_paypal': 'PayPal',
    'su.pay_method_cash': 'Barzahlung',
    'su.pay_method_pickup': 'Abholung im Store',
    'su.extra_setup':     'Einmaliges Setup-Paket für Onboarding, Import und Go-live-Vorbereitung einschließen.',
    'su.extra_tse':       'TSE-Paket für deutsche Fiskal-Compliance einschließen.',
    'su.extra_support':   'Monatlichen IT-Support-Retainer für operative Unterstützung einschließen.',
    'su.options_hint':    'Hosting, Plattform-Wartung, SSL und eine verwaltete gooddining.app-Subdomain sind bereits enthalten. SMS-Nutzung wird nur bei tatsächlicher Nutzung berechnet.',
    'su.commercial_title': 'Kommerzielle Übersicht',
    'su.summary_trial_label': 'Testphase',
    'su.summary_launch_label': 'Startmodus',
    'su.summary_activation_label': 'Aktivierungsart',
    'su.summary_trial_value': '14 Tage',
    'su.summary_launch_value': 'Demo bezahlt',
    'su.summary_activation_value': 'Admin + Board-Vorschau',
    'su.footer_note':     'Sie brauchen zuerst einen individuellen Rollout mit mehreren Standorten, Migrationsplanung oder eine deutsche Compliance-Prüfung? <a href="/platform/contact.html">Vertrieb kontaktieren</a>.',
    'su.continue_cta':    'Weiter zur Konto-Einrichtung',
    'su.summary_demo_title': 'Demo-Zahlungsübersicht',
    'su.summary_plan_label': 'Paket',
    'su.summary_users_label': 'Aktive Nutzer',
    'su.summary_included_label': 'Inklusive',
    'su.summary_included_value': 'Hosting + SSL + verwaltete Subdomain',
    'su.summary_sms_label': 'SMS-Nutzung',
    'su.summary_sms_value': 'Wird separat berechnet, falls genutzt',
    'su.summary_monthly_label': 'Monatliche Schätzung',
    'su.summary_today_label': 'Heute fällig im Demo-Modus',
    'su.summary_enterprise': 'Enterprise-Preise werden manuell über Kontakt abgewickelt.',

    'ct.title':           'Kontakt',
    'ct.subtitle':        'Fragen zu Preisen, Demo-Anfragen oder Support — schreib uns.',
    'ct.name':            'Dein Name',
    'ct.email':           'E-Mail',
    'ct.subject':         'Betreff',
    'ct.message':         'Nachricht',
    'ct.send':            'Nachricht senden',
    'ct.success':         'Danke! Wir melden uns innerhalb von 24 Stunden.',
    'ct.direct':          'Oder schreib uns direkt:',
    'ct.side_title':      'Wie können wir helfen?',
    'ct.side_desc':       'Wir antworten innerhalb von 24 Stunden an Werktagen.',
    'ct.email_val':       'hallo@restaurantos.app',
    'ct.location':        'Berlin, Deutschland',
  },

  vi: {
    'nav.features':       'Tính năng',
    'nav.pricing':        'Bảng giá',
    'nav.contact':        'Liên hệ',
    'nav.login':          'Đăng nhập',
    'nav.signup':         'Dùng thử miễn phí',
    'log.title':          'Chọn đúng cổng đăng nhập',
    'log.subtitle':       'Restaurant OS có các điểm vào khác nhau cho operator của nền tảng, admin nhà hàng và nhân viên vận hành. Hãy chọn đúng bối cảnh trước, rồi nhập PIN ở màn hình kế tiếp.',
    'log.role_platform':  'Operator nền tảng',
    'log.role_platform_desc': 'Giá dịch vụ, signup và operator console',
    'log.role_tenant':    'Admin nhà hàng',
    'log.role_tenant_desc': 'Cấu hình công ty, nhân sự và tích hợp',
    'log.role_board':     'Booking board',
    'log.role_board_desc': 'Bảng FOH trực tiếp và truy cập nhân viên bằng PIN',
    'log.ctx_platform_title': 'Mở operator console của nền tảng',
    'log.ctx_platform_desc': 'Dùng mục này khi bạn quản lý giá SaaS, signup đi vào hệ thống và quy trình follow-up của operator.',
    'log.ctx_tenant_title': 'Mở trang admin của nhà hàng',
    'log.ctx_tenant_desc': 'Dùng mục này cho thiết lập cấp nhà hàng, quản lý nhân sự, cấu hình website và vận hành.',
    'log.ctx_board_title': 'Mở booking board',
    'log.ctx_board_desc': 'Dùng mục này cho host stand, booking thời gian thực và thao tác phía nhân viên trong ca.',
    'log.company_label':  'Company ID',
    'log.company_hint':   'Bắt buộc trên localhost và host preview workers.dev.',
    'log.slug_label':     'Subdomain workspace',
    'log.slug_hint':      'Tùy chọn trong chế độ single-domain. Ví dụ: esskultur-main',
    'log.local_note':     'Bản local preview cần company_id để xác định đúng tenant context.',
    'log.remote_note':    'Nếu tenant của bạn dùng subdomain riêng, hãy nhập tại đây. Nếu không, hệ thống sẽ dùng host hiện tại.',
    'log.platform_note':  'Truy cập operator nền tảng không cần tenant context. Bạn sẽ nhập operator PIN ở màn hình kế tiếp.',
    'log.continue_platform': 'Tiếp tục tới platform admin',
    'log.continue_tenant': 'Tiếp tục tới admin nhà hàng',
    'log.continue_board': 'Tiếp tục tới booking board',
    'log.cancel':         'Hủy',
    'log.err_company':    'Hãy nhập company ID hợp lệ để tiếp tục trên host này.',

    'hero.badge':         '🍽️ Restaurant OS — Xây dựng cho nhà hàng hiện đại',
    'hero.title':         'Vận hành nhà hàng,\nkhông phải phần mềm',
    'hero.subtitle':      'Từ đặt bàn trực tuyến đến vận hành nhân viên và website riêng — tất cả những gì nhà hàng bạn cần trong một hệ thống.',
    'hero.cta1':          'Dùng thử 14 ngày miễn phí',
    'hero.cta2':          'Xem bảng giá',
    'hero.m1':            'Không cần thẻ tín dụng',
    'hero.m2':            'Cài đặt dưới 1 giờ',
    'hero.m3':            'Hủy bất cứ lúc nào',

    'feat.tag':           'Mọi thứ bạn cần',
    'feat.h2':            'Xây dựng cho cách nhà hàng thực sự hoạt động',
    'feat.sub':           'Không phải ERP. Không phải nền tảng chung chung. Thiết kế riêng cho vận hành nhà hàng hằng ngày.',
    'feat.booking.title': 'Đặt bàn online & tại chỗ',
    'feat.booking.desc':  'Khách đặt bàn trực tuyến. Nhân viên tạo walk-in. Tất cả đổ vào một bảng thời gian thực tức thì.',
    'feat.board.title':   'Bảng đặt bàn trực tiếp',
    'feat.board.desc':    'Xem đặt bàn trong ngày một cái nhìn. Xác nhận, xếp chỗ, hoàn tất — trên một màn hình.',
    'feat.stages.title':  'Quản lý giai đoạn',
    'feat.stages.desc':   'Chờ → Xác nhận → Đã đến → Hoàn tất. Chuyển khách qua từng bước chỉ một chạm.',
    'feat.website.title': 'Website nhà hàng của bạn',
    'feat.website.desc':  'Website chuyên nghiệp tại subdomain riêng. Menu, form đặt bàn, liên hệ — sẵn sàng trong vài phút.',
    'feat.staff.title':   'App PIN cho nhân viên',
    'feat.staff.desc':    'Không cần quản lý tài khoản. Nhân viên đăng nhập bằng mã PIN 4 chữ số. Chạy trên mọi điện thoại.',
    'feat.crm.title':     'CRM khách hàng',
    'feat.crm.desc':      'Hồ sơ khách, lịch sử đặt bàn, ghi chú và tag. Hoàn toàn nội bộ trong cơ sở dữ liệu của bạn — không cần CRM bên ngoài.',
    'feat.crm.phase':     'Giai đoạn 4',

    'price.tag':          'Bảng giá',
    'price.h2':           'Giá đơn giản, minh bạch',
    'price.sub':          'Tính theo mỗi nhân sự đang hoạt động, nhưng thứ bạn mua là kết quả. Hosting và thiết lập domain tiêu chuẩn đã bao gồm.',
    'price.core_name':    'Online',
    'price.com_name':     'Vận hành',
    'price.grow_name':    'Khách quay lại',
    'price.ent_name':     'Chuỗi',
    'price.popular':      'Phổ biến nhất',
    'price.cta':          'Bắt đầu dùng thử',
    'price.cta_ent':      'Liên hệ chúng tôi',
    'price.core_desc':    'Dành cho nhà hàng cần website thương hiệu trên subdomain được quản lý.',
    'price.com_desc':     'Cho nhà hàng cần POS, vận hành phục vụ và máy tính tiền theo tiêu chuẩn Đức.',
    'price.grow_desc':    'Cho nhà hàng muốn có SMS marketing và quản lý khách thân thiết ngay trong hệ thống.',
    'price.ent_desc':     'Nhiều chi nhánh, tích hợp tùy chỉnh, hỗ trợ SLA chuyên biệt.',
    'price.core_f1':      'Website cho nhà hàng',
    'price.core_f2':      'Được host trên subdomain gooddining.app của bạn',
    'price.core_f3':      'Trang liên hệ và thông tin',
    'price.core_f4':      'Không bao gồm luồng đặt bàn',
    'price.core_f5':      'Đã bao gồm hosting',
    'price.core_f6':      'Đã bao gồm SSL',
    'price.com_f1':       'Bao gồm toàn bộ gói Online',
    'price.com_f2':       'POS cho nhà hàng',
    'price.com_f3':       'Booking board, nhắc lịch và xác nhận',
    'price.com_f4':       'PIN nhanh cho nhân viên và xử lý khách walk-in',
    'price.com_f5':       'Máy tính tiền theo tiêu chuẩn Đức',
    'price.com_f6':       'Có thể thêm TSE cho nhu cầu tuân thủ tại Đức',
    'price.grow_f1':      'Bao gồm toàn bộ gói Vận hành',
    'price.grow_f2':      'SMS marketing cho khách cũ',
    'price.grow_f3':      'Hồ sơ và phân nhóm khách thân thiết',
    'price.grow_f4':      'Kịch bản win-back đơn giản',
    'price.grow_f5':      'Theo dõi và chăm sóc khách quay lại',
    'price.ent_f1':       'Bao gồm toàn bộ gói Khách quay lại',
    'price.ent_f2':       'Hỗ trợ nhiều chi nhánh',
    'price.ent_f3':       'API tích hợp tùy chỉnh',
    'price.ent_f4':       'Onboarding & SLA chuyên biệt',
    'price.per_mo':       '/người dùng hoạt động/tháng',
    'price.custom':       'Liên hệ',
    'price.extras_title': 'Bao gồm và add-on',
    'price.included_title': 'Bao gồm trong mọi gói',
    'price.included_body': 'Hosting, bảo trì nền tảng, SSL và một subdomain gooddining.app được quản lý.',
    'price.setup_title':  'Onboarding một lần',
    'price.sms_title':    'Gửi SMS',
    'price.tse_title':    'Tuân thủ tài chính tại Đức',
    'price.support_title': 'Hỗ trợ IT',
    'price.note':         'Tính phí theo số người dùng hoạt động. Đã bao gồm hosting, bảo trì nền tảng, SSL và một subdomain gooddining.app được quản lý. Add-on chỉ áp dụng cho SMS, TSE, onboarding và hỗ trợ IT nếu chọn thêm.',
    'price.setup_value':  '{amount} phí setup một lần',
    'price.sms_value':    'Tính theo sử dụng, chỉ khi bạn gửi SMS nhắc lịch hoặc chiến dịch.',
    'price.tse_value':    '{amount}/tháng cho gói TSE',
    'price.support_value': '{hourly}/giờ hỗ trợ IT hoặc {monthly}/tháng gói retainer',

    'footer.tagline':     'Restaurant OS — xây dựng riêng cho vận hành nhà hàng hiện đại. Theo thời gian thực và hỗ trợ nhiều tenant.',
    'footer.product':     'Sản phẩm',
    'footer.legal':       'Pháp lý',
    'footer.support':     'Hỗ trợ',
    'footer.features':    'Tính năng',
    'footer.pricing':     'Bảng giá',
    'footer.contact':     'Liên hệ',
    'footer.terms':       'Điều khoản dịch vụ',
    'footer.privacy':     'Chính sách bảo mật',
    'footer.impressum':   'Impressum',
    'footer.docs':        'Tài liệu',
    'footer.status':      'Trạng thái hệ thống',
    'footer.copyright':   '© 2026 Restaurant OS. Bảo lưu mọi quyền.',

    'su.title':           'Tạo tài khoản của bạn',
    'su.subtitle':        'Dùng thử 14 ngày miễn phí. Không cần thẻ tín dụng.',
    'su.s1':              'Gói',
    'su.s2':              'Nhà hàng',
    'su.s3':              'Tài khoản',
    'su.s4':              'Xong',
    'su.back':            'Quay lại',
    'su.next':            'Tiếp tục',
    'su.submit':          'Tạo tài khoản',
    'su.plan_label':      'Chọn gói của bạn',
    'su.name_label':      'Tên nhà hàng',
    'su.name_ph':         'VD: Trattoria Roma',
    'su.addr_label':      'Địa chỉ',
    'su.addr_ph':         'Đường, thành phố',
    'su.country_label':   'Quốc gia',
    'su.email_label':     'Email chủ nhà hàng',
    'su.email_ph':        'ban@nhahang.com',
    'su.phone_label':     'Số điện thoại (tùy chọn)',
    'su.sub_label':       'Subdomain gooddining.app của bạn',
    'su.sub_hint':        'Khách sẽ thấy URL này trên website của bạn. Chỉ dùng chữ thường, số và dấu gạch ngang.',
    'su.sub_checking':    'Đang kiểm tra…',
    'su.sub_ok':          '✓ Có sẵn',
    'su.sub_taken':       '✗ Đã được dùng — thử tên khác',
    'su.pass_label':      'Mật khẩu',
    'su.pass_hint':       'Tối thiểu 8 ký tự.',
    'su.agree_pre':       'Tôi đồng ý với',
    'su.agree_terms':     'Điều khoản dịch vụ',
    'su.agree_and':       'và',
    'su.agree_priv':      'Chính sách bảo mật',
    'su.ok_title':        'Kiểm tra email của bạn!',
    'su.ok_body':         'Chúng tôi đã gửi link xác nhận đến <strong>{email}</strong>. Nhấp vào link để kích hoạt tài khoản và mở trình hướng dẫn cài đặt.',
    'su.ok_note':         'Link hết hạn sau 24 giờ. Kiểm tra thư mục spam nếu không thấy trong vài phút.',
    'su.ent_note':        'Đối với gói Enterprise, vui lòng liên hệ trực tiếp.',
    'su.ent_link':        'Liên hệ bộ phận kinh doanh →',
    'su.plan_hint':       'Nên chọn từ trái sang phải',
    'su.plan_core_f1':    'Website nhà hàng trên subdomain gooddining.app của bạn',
    'su.plan_core_f2':    'Trang liên hệ, giờ mở cửa và thông tin cơ bản',
    'su.plan_core_f3':    'Đã bao gồm hosting và SSL. Không có luồng đặt bàn',
    'su.plan_com_f1':     'Bao gồm toàn bộ gói Online, cộng thêm POS nhà hàng',
    'su.plan_com_f2':     'Booking board, nhắc lịch, walk-in và PIN cho nhân viên',
    'su.plan_com_f3':     'Máy tính tiền tiêu chuẩn Đức, TSE chọn thêm khi cần',
    'su.plan_grow_f1':    'Bao gồm toàn bộ gói Vận hành, cộng thêm SMS marketing',
    'su.plan_grow_f2':    'Phân nhóm khách thân thiết, ưu đãi quay lại và chăm sóc tiếp nối',
    'su.plan_grow_f3':    'Dành cho nhà hàng muốn tăng khách quay lại',
    'su.plan_ent_f1':     'Bao gồm toàn bộ gói Khách quay lại, cộng thêm rollout đa chi nhánh',
    'su.plan_ent_f2':     'Onboarding riêng và thảo luận SLA',
    'su.plan_ent_f3':     'Báo giá và scope tích hợp theo nhu cầu',
    'su.side_title':      'Cấu hình workspace',
    'su.side_live':       'Xem trước trực tiếp',
    'su.initial_title':   'Thiết lập ban đầu',
    'su.users_label':     'Số người dùng hoạt động dự kiến',
    'su.users_hint':      'Dùng để ước tính phí định kỳ và nhu cầu nhân sự.',
    'su.options_title':   'Tùy chọn hóa đơn demo',
    'su.pay_method_label': 'Phương thức thanh toán demo',
    'su.pay_method_hint': 'Chọn cách ghi nhận khoản thanh toán onboarding demo này cho tenant.',
    'su.pay_method_bankcard': 'Thẻ ngân hàng',
    'su.pay_method_paypal': 'PayPal',
    'su.pay_method_cash': 'Tiền mặt',
    'su.pay_method_pickup': 'Thanh toán khi nhận tại cửa hàng',
    'su.extra_setup':     'Bao gồm gói setup một lần cho onboarding, import và chuẩn bị go-live.',
    'su.extra_tse':       'Bao gồm gói TSE cho nhu cầu tuân thủ tài chính tại Đức.',
    'su.extra_support':   'Bao gồm gói hỗ trợ IT hàng tháng cho vận hành thực tế.',
    'su.options_hint':    'Hosting, bảo trì nền tảng, SSL và một subdomain gooddining.app được quản lý đã được bao gồm. SMS chỉ tính phí khi thực sự sử dụng.',
    'su.commercial_title': 'Tóm tắt thương mại',
    'su.summary_trial_label': 'Dùng thử',
    'su.summary_launch_label': 'Chế độ triển khai',
    'su.summary_activation_label': 'Kiểu kích hoạt',
    'su.summary_trial_value': '14 ngày',
    'su.summary_launch_value': 'Demo có phí',
    'su.summary_activation_value': 'Xem trước admin + board',
    'su.footer_note':     'Nếu bạn cần rollout nhiều chi nhánh, kế hoạch migration hoặc rà soát compliance tại Đức trước, <a href="/platform/contact.html">hãy nói chuyện với sales</a>.',
    'su.continue_cta':    'Tiếp tục sang tạo tài khoản',
    'su.summary_demo_title': 'Xem trước thanh toán demo',
    'su.summary_plan_label': 'Gói',
    'su.summary_users_label': 'Người dùng hoạt động',
    'su.summary_included_label': 'Đã bao gồm',
    'su.summary_included_value': 'Hosting + SSL + subdomain được quản lý',
    'su.summary_sms_label': 'Chi phí SMS',
    'su.summary_sms_value': 'Tính riêng nếu có sử dụng',
    'su.summary_monthly_label': 'Ước tính hàng tháng',
    'su.summary_today_label': 'Cần trả hôm nay ở chế độ demo',
    'su.summary_enterprise': 'Giá gói Enterprise được xử lý thủ công qua liên hệ.',

    'ct.title':           'Liên hệ chúng tôi',
    'ct.subtitle':        'Câu hỏi về giá, yêu cầu demo hoặc hỗ trợ — gửi tin nhắn cho chúng tôi.',
    'ct.name':            'Tên của bạn',
    'ct.email':           'Email',
    'ct.subject':         'Chủ đề',
    'ct.message':         'Tin nhắn',
    'ct.send':            'Gửi tin nhắn',
    'ct.success':         'Cảm ơn! Chúng tôi sẽ phản hồi trong vòng 24 giờ.',
    'ct.direct':          'Hoặc email trực tiếp:',
    'ct.side_title':      'Chúng tôi có thể giúp gì?',
    'ct.side_desc':       'Chúng tôi phản hồi trong vòng 24 giờ vào ngày làm việc.',
    'ct.email_val':       'hello@restaurantos.app',
    'ct.location':        'Berlin, Đức',
  }
};

// ── Translation helper ────────────────────────────────

function t(key) {
  return T[ROS_LANG]?.[key] || T['en']?.[key] || key;
}

function tFormat(key, values = {}) {
  return String(t(key)).replace(/\{(\w+)\}/g, (_, token) => {
    return Object.prototype.hasOwnProperty.call(values, token) ? String(values[token]) : `{${token}}`;
  });
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === ROS_LANG);
  });
  document.documentElement.lang = ROS_LANG;
  updateLoginModalCopy();
  applyPlatformPlansToPage();
  updateSignupPricingSummary();
}

function setLang(lang) {
  ROS_LANG = normalizeRosLang(lang) || 'en';
  try {
    localStorage.setItem('ros-lang', ROS_LANG);
  } catch {
    // Ignore storage failures and keep the session language in memory.
  }
  applyLang();
}

function getPlanNameKey(planId) {
  if (planId === 'core') return 'price.core_name';
  if (planId === 'commerce') return 'price.com_name';
  if (planId === 'growth') return 'price.grow_name';
  if (planId === 'enterprise') return 'price.ent_name';
  return null;
}

const LOGIN_ROLE_CONFIG = Object.freeze({
  platform: {
    path: '/platform/admin.html',
    titleKey: 'log.ctx_platform_title',
    descKey: 'log.ctx_platform_desc',
    noteKey: 'log.platform_note',
    ctaKey: 'log.continue_platform',
  },
  tenant: {
    path: '/admin',
    titleKey: 'log.ctx_tenant_title',
    descKey: 'log.ctx_tenant_desc',
    noteKey: 'log.local_note',
    ctaKey: 'log.continue_tenant',
  },
  board: {
    path: '/board',
    titleKey: 'log.ctx_board_title',
    descKey: 'log.ctx_board_desc',
    noteKey: 'log.local_note',
    ctaKey: 'log.continue_board',
  }
});

let rosLoginRole = null;

function getRequestedCompanyIdFromLocation() {
  try {
    const raw = String(new URLSearchParams(window.location.search || '').get('company_id') || '').trim();
    const value = Number(raw || 0);
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function platformHostRequiresCompanyIdQuery() {
  const host = String(window.location.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.includes('workers.dev');
}

function sanitizeWorkspaceSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getWorkspaceBaseHostname() {
  const host = String(window.location.hostname || '').toLowerCase();
  return host.startsWith('www.') ? host.slice(4) : host;
}

function getDefaultLoginRole() {
  const path = String(window.location.pathname || '').toLowerCase();
  if (path.startsWith('/platform/admin')) return 'platform';
  return 'tenant';
}

function getLoginRoleConfig(role) {
  return LOGIN_ROLE_CONFIG[role] || LOGIN_ROLE_CONFIG[getDefaultLoginRole()];
}

function renderLoginModal() {
  return `
<div class="login-modal" id="ros-login-modal" hidden>
  <div class="login-modal-backdrop" onclick="closeLoginModal()"></div>
  <div class="login-modal-panel" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
    <button type="button" class="login-modal-close" aria-label="Close" onclick="closeLoginModal()">×</button>
    <div class="login-modal-head">
      <div class="section-tag" data-i18n="nav.login">Log in</div>
      <h2 id="login-modal-title" data-i18n="log.title">Choose your login surface</h2>
      <p class="text-muted" data-i18n="log.subtitle">Restaurant OS uses different entry points for platform operators, tenant admins, and staff. Pick the right surface first, then continue with your PIN on the next screen.</p>
    </div>

    <div class="login-role-grid">
      <button type="button" class="login-role-card" data-login-role="platform" onclick="selectLoginRole('platform')">
        <strong data-i18n="log.role_platform">Platform operator</strong>
        <span data-i18n="log.role_platform_desc">Pricing, signups, and operator console</span>
      </button>
      <button type="button" class="login-role-card" data-login-role="tenant" onclick="selectLoginRole('tenant')">
        <strong data-i18n="log.role_tenant">Restaurant admin</strong>
        <span data-i18n="log.role_tenant_desc">Company settings, staff, and integrations</span>
      </button>
      <button type="button" class="login-role-card" data-login-role="board" onclick="selectLoginRole('board')">
        <strong data-i18n="log.role_board">Booking board</strong>
        <span data-i18n="log.role_board_desc">Front-of-house live board and staff PIN access</span>
      </button>
    </div>

    <div class="login-context-card">
      <h3 id="login-context-title"></h3>
      <p class="text-muted" id="login-context-desc"></p>

      <div class="login-context-grid">
        <div class="form-group" id="login-company-group">
          <label for="login-company-id" data-i18n="log.company_label">Company ID</label>
          <input id="login-company-id" type="number" min="1" step="1" placeholder="1" />
          <div class="form-hint" data-i18n="log.company_hint">Required on localhost and workers.dev preview hosts.</div>
        </div>

        <div class="form-group" id="login-subdomain-group">
          <label for="login-subdomain" data-i18n="log.slug_label">Workspace subdomain</label>
          <input id="login-subdomain" type="text" data-i18n-placeholder="log.slug_hint" placeholder="Optional in single-domain mode. Example: esskultur-main" />
          <div class="form-hint" data-i18n="log.slug_hint">Optional in single-domain mode. Example: esskultur-main</div>
        </div>
      </div>

      <div class="alert alert-info login-context-note" id="login-context-note"></div>
      <div class="alert alert-error" id="login-module-error" style="display:none;"></div>
    </div>

    <div class="login-modal-actions">
      <button type="button" class="btn btn-ghost" data-i18n="log.cancel" onclick="closeLoginModal()">Cancel</button>
      <button type="button" class="btn btn-primary" id="login-continue-btn" onclick="continueLogin()">Continue</button>
    </div>
  </div>
</div>`;
}

function syncLoginInputs() {
  const companyInput = document.getElementById('login-company-id');
  const requestedCompanyId = getRequestedCompanyIdFromLocation();
  if (companyInput && requestedCompanyId && !companyInput.value) {
    companyInput.value = String(requestedCompanyId);
  }
}

function clearLoginModuleError() {
  const errorEl = document.getElementById('login-module-error');
  if (!errorEl) return;
  errorEl.style.display = 'none';
  errorEl.textContent = '';
}

function showLoginModuleError(message) {
  const errorEl = document.getElementById('login-module-error');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function updateLoginModalCopy() {
  const role = rosLoginRole || getDefaultLoginRole();
  const config = getLoginRoleConfig(role);
  const needsCompanyId = platformHostRequiresCompanyIdQuery();
  const isPlatformRole = role === 'platform';

  document.querySelectorAll('.login-role-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.loginRole === role);
  });

  const titleEl = document.getElementById('login-context-title');
  if (titleEl) titleEl.textContent = t(config.titleKey);

  const descEl = document.getElementById('login-context-desc');
  if (descEl) descEl.textContent = t(config.descKey);

  const noteEl = document.getElementById('login-context-note');
  if (noteEl) {
    noteEl.textContent = isPlatformRole ? t('log.platform_note') : t(needsCompanyId ? 'log.local_note' : 'log.remote_note');
    noteEl.style.display = 'block';
  }

  const companyGroup = document.getElementById('login-company-group');
  if (companyGroup) {
    companyGroup.style.display = !isPlatformRole && needsCompanyId ? 'block' : 'none';
  }

  const subdomainGroup = document.getElementById('login-subdomain-group');
  if (subdomainGroup) {
    subdomainGroup.style.display = !isPlatformRole && !needsCompanyId ? 'block' : 'none';
  }

  const continueBtn = document.getElementById('login-continue-btn');
  if (continueBtn) continueBtn.textContent = t(config.ctaKey);
}

function selectLoginRole(role) {
  rosLoginRole = LOGIN_ROLE_CONFIG[role] ? role : getDefaultLoginRole();
  clearLoginModuleError();
  updateLoginModalCopy();
}

function openLoginModal(role) {
  const modal = document.getElementById('ros-login-modal');
  if (!modal) return;

  rosLoginRole = LOGIN_ROLE_CONFIG[role] ? role : (rosLoginRole || getDefaultLoginRole());
  syncLoginInputs();
  clearLoginModuleError();
  updateLoginModalCopy();
  modal.hidden = false;
  modal.classList.add('open');
  document.body.classList.add('login-modal-open');

  const focusTarget = rosLoginRole === 'platform'
    ? document.getElementById('login-continue-btn')
    : (platformHostRequiresCompanyIdQuery() ? document.getElementById('login-company-id') : document.getElementById('login-subdomain'));
  focusTarget?.focus();
}

function closeLoginModal() {
  const modal = document.getElementById('ros-login-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.classList.remove('open');
  document.body.classList.remove('login-modal-open');
  clearLoginModuleError();
}

function continueLogin() {
  const role = rosLoginRole || getDefaultLoginRole();
  const config = getLoginRoleConfig(role);
  if (role === 'platform') {
    window.location.assign(new URL(config.path, window.location.origin).toString());
    return;
  }

  const targetUrl = new URL(config.path, window.location.origin);
  const needsCompanyId = platformHostRequiresCompanyIdQuery();

  if (needsCompanyId) {
    const companyId = Number.parseInt(String(document.getElementById('login-company-id')?.value || '').trim(), 10);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      showLoginModuleError(t('log.err_company'));
      document.getElementById('login-company-id')?.focus();
      return;
    }
    targetUrl.searchParams.set('company_id', String(companyId));
  } else {
    const slug = sanitizeWorkspaceSlug(document.getElementById('login-subdomain')?.value || '');
    if (slug) {
      targetUrl.hostname = `${slug}.${getWorkspaceBaseHostname()}`;
    }
  }

  window.location.assign(targetUrl.toString());
}

// ── Shared nav render ─────────────────────────────────

function renderNav() {
  return `
<nav class="nav">
  <a href="/platform/" class="nav-logo">Restaurant OS</a>
  <ul class="nav-links desktop-only">
    <li><a href="/platform/#features" data-i18n="nav.features">Features</a></li>
    <li><a href="/platform/#pricing"  data-i18n="nav.pricing">Pricing</a></li>
    <li><a href="/platform/contact.html" data-i18n="nav.contact">Contact</a></li>
    <li><a href="/platform/admin.html" data-i18n="nav.login" onclick="openLoginModal(); return false;">Log in</a></li>
    <li><a href="/platform/signup.html" class="btn-nav-cta" data-i18n="nav.signup">Start free trial</a></li>
  </ul>
  <div class="nav-lang">
    <button class="lang-btn" data-lang="en" onclick="setLang('en')">EN</button>
    <button class="lang-btn" data-lang="de" onclick="setLang('de')">DE</button>
    <button class="lang-btn" data-lang="vi" onclick="setLang('vi')">VI</button>
  </div>
</nav>`;
}

function renderFooter() {
  return `
<footer>
  <div class="footer-grid">
    <div>
      <div class="footer-brand">Restaurant OS</div>
      <p class="footer-tagline" data-i18n="footer.tagline"></p>
    </div>
    <div>
      <div class="footer-col-title" data-i18n="footer.product">Product</div>
      <ul class="footer-links">
        <li><a href="/platform/#features" data-i18n="footer.features">Features</a></li>
        <li><a href="/platform/#pricing"  data-i18n="footer.pricing">Pricing</a></li>
        <li><a href="/platform/contact.html" data-i18n="footer.contact">Contact</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title" data-i18n="footer.legal">Legal</div>
      <ul class="footer-links">
        <li><a href="/platform/legal/terms.html"      data-i18n="footer.terms">Terms & Conditions</a></li>
        <li><a href="/platform/legal/privacy.html"    data-i18n="footer.privacy">Privacy Policy</a></li>
        <li><a href="/platform/legal/impressum.html"  data-i18n="footer.impressum">Impressum</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title" data-i18n="footer.support">Support</div>
      <ul class="footer-links">
        <li><a href="/platform/contact.html" data-i18n="footer.contact">Contact</a></li>
        <li><a href="mailto:hello@restaurantos.app">hello@restaurantos.app</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span data-i18n="footer.copyright">© 2026 Restaurant OS. All rights reserved.</span>
    <div class="footer-bottom-links">
      <a href="/platform/legal/terms.html"     data-i18n="footer.terms">Terms</a>
      <a href="/platform/legal/privacy.html"   data-i18n="footer.privacy">Privacy</a>
      <a href="/platform/legal/impressum.html" data-i18n="footer.impressum">Impressum</a>
    </div>
  </div>
</footer>`;
}

// ── Subdomain availability check ──────────────────────

let subdomainTimer = null;
let subdomainValid = false;
let platformPlansData = null;

function checkSubdomain(slug) {
  const statusEl = document.getElementById('subdomain-status');
  if (!statusEl) return;
  clearTimeout(subdomainTimer);

  if (!slug || slug.length < 3) {
    statusEl.textContent = '';
    statusEl.className = 'subdomain-status';
    subdomainValid = false;
    return;
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    statusEl.textContent = '✗ Only lowercase letters, numbers, and hyphens';
    statusEl.className = 'subdomain-status taken';
    subdomainValid = false;
    return;
  }

  statusEl.textContent = t('su.sub_checking');
  statusEl.className = 'subdomain-status checking';

  subdomainTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/platform/signup/check-subdomain?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (data.available) {
        statusEl.textContent = t('su.sub_ok');
        statusEl.className = 'subdomain-status ok';
        subdomainValid = true;
      } else {
        statusEl.textContent = t('su.sub_taken');
        statusEl.className = 'subdomain-status taken';
        subdomainValid = false;
      }
    } catch {
      // API not yet implemented — optimistic in dev
      statusEl.textContent = t('su.sub_ok') + ' (dev mode)';
      statusEl.className = 'subdomain-status ok';
      subdomainValid = true;
    }
  }, 400);
}

// ── Signup wizard state ───────────────────────────────

const state = { step: 1, plan: 'core', email: '', signupResult: null };

function euro(value) {
  const normalized = Number(value || 0);
  const amount = Number.isFinite(normalized) ? normalized : 0;
  return `€${amount.toFixed(Number.isInteger(amount) ? 0 : 2)}`;
}

async function loadPlatformPlans() {
  try {
    const res = await fetch('/api/platform/plans');
    const data = await res.json();
    if (res.ok && data.ok) {
      platformPlansData = data;
      applyPlatformPlansToPage();
      updateSignupPricingSummary();
      syncSignupPaymentMethodOptions();
    }
  } catch {
    // Keep static fallback content if API unavailable.
  }
}

function renderPlanFeatures(listEl, features) {
  if (!listEl) return;
  listEl.replaceChildren();
  (Array.isArray(features) ? features : []).forEach((feature) => {
    const item = document.createElement('li');
    item.textContent = String(feature || '').trim();
    listEl.appendChild(item);
  });
}

function applyPlatformPlansToPage() {
  if (!platformPlansData?.plans) return;

  for (const plan of platformPlansData.plans) {
    const nameEls = document.querySelectorAll(`[data-plan-name="${plan.id}"]`);
    nameEls.forEach((el) => {
      el.textContent = plan.name || '';
    });

    const descEls = document.querySelectorAll(`[data-plan-desc="${plan.id}"]`);
    descEls.forEach((el) => {
      el.textContent = plan.description || '';
    });

    const priceEls = document.querySelectorAll(`[data-plan-price="${plan.id}"]`);
    priceEls.forEach((el) => {
      if (plan.priceEurPerUserMonthly == null) {
        el.textContent = t('price.custom');
        return;
      }
      el.innerHTML = `${euro(plan.priceEurPerUserMonthly)}<span class="mo">${t('price.per_mo')}</span>`;
    });

    const featureEls = document.querySelectorAll(`[data-plan-features="${plan.id}"]`);
    featureEls.forEach((el) => {
      renderPlanFeatures(el, plan.features);
    });
  }

  const setupEl = document.getElementById('platform-extra-setup');
  const smsEl = document.getElementById('platform-extra-sms');
  const tseEl = document.getElementById('platform-extra-tse');
  const supportEl = document.getElementById('platform-extra-support');
  const noteEl = document.getElementById('platform-pricing-note');
  if (setupEl) setupEl.textContent = tFormat('price.setup_value', { amount: euro(platformPlansData.extras?.oneTimeSetupFeeEur) });
  if (smsEl) smsEl.textContent = t('price.sms_value');
  if (tseEl) tseEl.textContent = tFormat('price.tse_value', { amount: euro(platformPlansData.extras?.tseMonthlyFeeEur) });
  if (supportEl) {
    supportEl.textContent = tFormat('price.support_value', {
      hourly: euro(platformPlansData.extras?.itSupportHourlyEur),
      monthly: euro(platformPlansData.extras?.itSupportMonthlyRetainerEur)
    });
  }
  if (noteEl) noteEl.textContent = platformPlansData.pricingNote || t('price.note');
}

function getSelectedPlanData() {
  return platformPlansData?.plans?.find((plan) => plan.id === state.plan) || null;
}

function syncSignupPaymentMethodOptions() {
  const select = document.getElementById('f-demo-payment-method');
  if (!select) return;

  const enabledMethods = Array.isArray(platformPlansData?.paymentMethods?.enabled)
    ? platformPlansData.paymentMethods.enabled
    : ['bankcard', 'paypal', 'cash', 'pickup_at_store'];

  Array.from(select.options || []).forEach((option) => {
    option.disabled = !enabledMethods.includes(option.value);
  });

  if (!enabledMethods.includes(select.value)) {
    select.value = enabledMethods[0] || 'bankcard';
  }
}

function updateSignupPricingSummary() {
  const summaryEls = document.querySelectorAll('[data-signup-summary]');
  if (!summaryEls.length) return;

  const plan = getSelectedPlanData();
  const users = Math.max(1, Number(document.getElementById('f-staff-users')?.value || 1));
  const includeSetup = document.getElementById('f-extra-setup')?.checked !== false;
  const includeTse = !!document.getElementById('f-extra-tse')?.checked;
  const includeSupport = !!document.getElementById('f-extra-support')?.checked;

  if (!plan || plan.priceEurPerUserMonthly == null || !platformPlansData?.extras) {
    summaryEls.forEach((summaryEl) => {
      summaryEl.innerHTML = `<div class="alert alert-info">${t('su.summary_enterprise')}</div>`;
    });
    return;
  }

  const base = Number(plan.priceEurPerUserMonthly) * users;
  const setup = includeSetup ? Number(platformPlansData.extras.oneTimeSetupFeeEur || 0) : 0;
  const tse = includeTse ? Number(platformPlansData.extras.tseMonthlyFeeEur || 0) : 0;
  const support = includeSupport ? Number(platformPlansData.extras.itSupportMonthlyRetainerEur || 0) : 0;

  summaryEls.forEach((summaryEl) => {
    const planLabel = plan.name || t(getPlanNameKey(plan.id) || '') || plan.id;
    summaryEl.innerHTML = `
      <div class="alert alert-info" style="margin-top:6px;">
        <strong>${t('su.summary_demo_title')}</strong><br>
        ${t('su.summary_plan_label')}: ${planLabel}<br>
        ${t('su.summary_users_label')}: ${users}<br>
        ${t('su.summary_included_label')}: ${t('su.summary_included_value')}<br>
        ${t('su.summary_sms_label')}: ${t('su.summary_sms_value')}<br>
        ${t('su.summary_monthly_label')}: ${euro(base + tse + support)}<br>
        ${t('su.summary_today_label')}: ${euro(setup)}
      </div>
    `;
  });
}

function goStep(n) {
  if (n < 1 || n > 4) return;
  document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`#step-panel-${n}`)?.classList.add('active');
  document.querySelectorAll('.step-item').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i + 1 < n)  el.classList.add('done');
    if (i + 1 === n) el.classList.add('active');
  });
  state.step = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectPlan(plan) {
  state.plan = plan;
  document.querySelectorAll('.plan-card-choice').forEach(c => {
    c.classList.toggle('selected', c.dataset.plan === plan);
  });
  updateSignupPricingSummary();
}

function wizardNext() {
  if (state.step === 1) {
    if (!state.plan) { alert('Please select a plan'); return; }
    if (state.plan === 'enterprise') {
      window.location.href = '/platform/contact.html';
      return;
    }
    goStep(2);
  } else if (state.step === 2) {
    const name = document.getElementById('f-name')?.value.trim();
    if (!name) { showFieldError('f-name', 'Restaurant name is required'); return; }
    goStep(3);
  } else if (state.step === 3) {
    const email    = document.getElementById('f-email')?.value.trim();
    const subdomain = document.getElementById('f-subdomain')?.value.trim();
    const adminPin = document.getElementById('f-admin-pin')?.value;
    const agreed   = document.getElementById('f-agree')?.checked;
    if (!email || !email.includes('@')) { showFieldError('f-email', 'Valid email required'); return; }
    if (!subdomain || subdomain.length < 3) { showFieldError('f-subdomain', 'Subdomain required (min 3 chars)'); return; }
    if (!subdomainValid) { showFieldError('f-subdomain', 'Please wait for availability check'); return; }
    if (!/^\d{4}$/.test(adminPin || '')) { showFieldError('f-admin-pin', 'Admin PIN must be exactly 4 digits'); return; }
    if (!agreed) { alert('Please accept the Terms & Conditions and Privacy Policy'); return; }
    state.email = email;
    submitSignup();
  }
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'var(--danger)';
  const err = el.nextElementSibling;
  if (err && err.classList.contains('form-error')) {
    err.textContent = msg;
    err.style.display = 'block';
  }
  el.focus();
}

async function submitSignup() {
  const btn = document.getElementById('btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  const payload = {
    restaurant_name: document.getElementById('f-name')?.value.trim(),
    address:         document.getElementById('f-address')?.value.trim(),
    country:         document.getElementById('f-country')?.value,
    admin_name:      document.getElementById('f-admin-name')?.value.trim(),
    admin_pin:       document.getElementById('f-admin-pin')?.value.trim(),
    owner_email:     document.getElementById('f-email')?.value.trim(),
    owner_phone:     document.getElementById('f-phone')?.value.trim(),
    subdomain:       document.getElementById('f-subdomain')?.value.trim(),
    plan:            state.plan,
    staff_users:     Number(document.getElementById('f-staff-users')?.value || 1),
    website_template: document.getElementById('f-template')?.value || 'modern',
    demo_payment:    true,
    demo_payment_method: document.getElementById('f-demo-payment-method')?.value || 'bankcard',
    extras: {
      includeSetup: document.getElementById('f-extra-setup')?.checked !== false,
      includeTse: document.getElementById('f-extra-tse')?.checked || false,
      includeSupportRetainer: document.getElementById('f-extra-support')?.checked || false
    }
  };

  try {
    const res  = await fetch('/api/platform/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.ok) {
      state.signupResult = data;
      const body = `
        Account created for <strong>${payload.restaurant_name}</strong>.<br>
        Demo payment status: <strong>${data.payment?.paymentStatus || 'demo_paid'}</strong><br>
        Demo payment method: <strong>${data.payment?.paymentMethod || payload.demo_payment_method || 'bankcard'}</strong><br>
        Due today: <strong>${euro(data.payment?.dueTodayEur || 0)}</strong><br>
        Recurring monthly: <strong>${euro(data.payment?.recurringMonthlyEur || 0)}</strong><br><br>
        ${data.checkout_url ? `Stripe test checkout: <a href="${data.checkout_url}" target="_blank" rel="noopener">open checkout</a><br>` : ''}
        Preview admin: <a href="${data.preview_admin_url}" target="_blank" rel="noopener">open admin</a><br>
        ${data.preview_board_url ? `Preview board: <a href="${data.preview_board_url}" target="_blank" rel="noopener">open board</a><br>` : ''}
        Future public URL: <strong>${data.website_url}</strong><br>
        Admin PIN for test login: <strong>${data.admin_pin_hint}</strong>
      `;
      document.getElementById('success-body').innerHTML = body;
      goStep(4);
    } else {
      if (btn) { btn.disabled = false; btn.textContent = t('su.submit'); }
      const errEl = document.getElementById('signup-error');
      if (errEl) { errEl.textContent = data.message || 'Something went wrong. Please try again.'; errEl.style.display = 'block'; }
    }
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = t('su.submit'); }
    const errEl = document.getElementById('signup-error');
    if (errEl) {
      errEl.textContent = 'Network error while creating account. Please try again.';
      errEl.style.display = 'block';
    }
  }
}

async function confirmSignupCheckoutFromUrl() {
  const params = new URLSearchParams(window.location.search || '');
  if (params.get('checkout') !== 'success') return;

  const companyId = String(params.get('company_id') || '').trim();
  const sessionId = String(params.get('session_id') || '').trim();
  if (!companyId || !sessionId) return;

  try {
    const res = await fetch(`/api/platform/signup/confirm-payment?company_id=${encodeURIComponent(companyId)}&session_id=${encodeURIComponent(sessionId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const errEl = document.getElementById('signup-error');
      if (errEl) {
        errEl.textContent = data.error || 'Unable to confirm Stripe checkout yet.';
        errEl.style.display = 'block';
      }
      return;
    }

    const successBody = document.getElementById('success-body');
    if (successBody) {
      successBody.innerHTML = `Stripe payment confirmed.<br>Company ID: <strong>${companyId}</strong><br>Payment status: <strong>${data.payment_status || 'stripe_paid'}</strong><br>Session: <strong>${sessionId}</strong>`;
    }
    goStep(4);
  } catch {
    const errEl = document.getElementById('signup-error');
    if (errEl) {
      errEl.textContent = 'Network error while confirming Stripe checkout.';
      errEl.style.display = 'block';
    }
  }
}

// ── Contact form ──────────────────────────────────────

async function submitContact(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-contact');
  if (btn) { btn.disabled = true; }

  const payload = {
    name:    document.getElementById('ct-name')?.value.trim(),
    email:   document.getElementById('ct-email')?.value.trim(),
    subject: document.getElementById('ct-subject')?.value.trim(),
    message: document.getElementById('ct-message')?.value.trim(),
  };

  try {
    await fetch('/api/platform/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch { /* non-critical */ }

  // Always show success (optimistic UX)
  document.getElementById('contact-form')?.style.setProperty('display', 'none');
  const ok = document.getElementById('contact-success');
  if (ok) ok.style.display = 'block';
}

// ── Boot ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const navEl    = document.getElementById('nav-placeholder');
  const footerEl = document.getElementById('footer-placeholder');
  if (navEl)    navEl.outerHTML    = renderNav();
  if (footerEl) footerEl.outerHTML = renderFooter();
  if (!document.getElementById('ros-login-modal')) {
    document.body.insertAdjacentHTML('beforeend', renderLoginModal());
  }
  applyLang();
  loadPlatformPlans();
  confirmSignupCheckoutFromUrl();

  Object.assign(window, {
    setLang,
    selectLoginRole,
    openLoginModal,
    closeLoginModal,
    continueLogin,
    selectPlan,
    wizardNext,
  });

  // Subdomain live check
  const subInput = document.getElementById('f-subdomain');
  if (subInput) {
    subInput.addEventListener('input', e => checkSubdomain(e.target.value.toLowerCase().trim()));
    // Auto-fill subdomain from restaurant name
    const nameInput = document.getElementById('f-name');
    if (nameInput) {
      nameInput.addEventListener('blur', () => {
        if (!subInput.value) {
          const slug = nameInput.value.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 30);
          subInput.value = slug;
          checkSubdomain(slug);
        }
      });
    }
  }

  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', submitContact);
  }

  // Clear field error on input
  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', () => {
      el.style.borderColor = '';
      const err = el.nextElementSibling;
      if (err?.classList.contains('form-error')) err.style.display = 'none';
      updateSignupPricingSummary();
    });
  });
});
