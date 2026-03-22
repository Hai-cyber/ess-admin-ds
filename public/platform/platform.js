/* =====================================================
   Restaurant OS — Platform Site JS
   i18n (EN/DE/VI) + shared nav/footer + signup wizard
   ===================================================== */

// ── Language system ──────────────────────────────────

let ROS_LANG = localStorage.getItem('ros-lang') || 'en';

const T = {
  en: {
    // Nav
    'nav.features':       'Features',
    'nav.pricing':        'Pricing',
    'nav.contact':        'Contact',
    'nav.login':          'Log in',
    'nav.signup':         'Start free trial',

    // Hero
    'hero.badge':         '🍽️ Restaurant OS — Built for modern restaurants',
    'hero.title':         'Run your restaurant,\nnot your software',
    'hero.subtitle':      'From online bookings to POS to your own website — everything your restaurant needs, on one Cloudflare-powered platform.',
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
    'feat.crm.desc':      'Guest profiles, booking history, notes, and tags. All first-party in your own database — no Odoo needed.',
    'feat.crm.phase':     'Phase 4',

    // Pricing
    'price.tag':          'Pricing',
    'price.h2':           'Simple, transparent pricing',
    'price.sub':          'Start with Core and grow into what you need. No hidden fees.',
    'price.popular':      'Most popular',
    'price.cta':          'Start free trial',
    'price.cta_ent':      'Contact us',
    'price.core_desc':    'Everything a new restaurant needs to go live.',
    'price.com_desc':     'Full table, order, and payment control.',
    'price.grow_desc':    'CRM, loyalty, and marketing for growing restaurants.',
    'price.ent_desc':     'Multi-location, custom integrations, dedicated SLA support.',
    'price.core_f1':      'Restaurant website (3 templates)',
    'price.core_f2':      'Contact form',
    'price.core_f3':      'Online booking form',
    'price.core_f4':      'Booking email notifications',
    'price.core_f5':      'Basic admin dashboard',
    'price.core_f6':      'Website builder starter setup',
    'price.com_f1':       'Everything in Core',
    'price.com_f2':       'Onsite booking + walk-ins',
    'price.com_f3':       'Booking board + stage management',
    'price.com_f4':       'SMS notifications + staff PIN app',
    'price.com_f5':       'POS + payment methods: cash, PayPal, debit/credit card, Apple Pay',
    'price.com_f6':       'Stripe can be one configured payment gateway + TSE',
    'price.grow_f1':      'Everything in Commerce',
    'price.grow_f2':      'CRM: guest profiles + history',
    'price.grow_f3':      'Loyalty program',
    'price.grow_f4':      'Marketing automation',
    'price.grow_f5':      'SEO tools',
    'price.ent_f1':       'Everything in Growth',
    'price.ent_f2':       'Multi-location support',
    'price.ent_f3':       'Custom integrations API',
    'price.ent_f4':       'Dedicated onboarding + SLA',
    'price.per_mo':       '/mo',
    'price.custom':       'Custom',

    // Footer
    'footer.tagline':     'Restaurant OS — purpose-built for modern restaurant operations. Cloudflare-native, real-time, multi-tenant.',
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
    'su.sub_label':       'Your Restaurant OS URL',
    'su.sub_hint':        'Guests see this URL when booking online. Lowercase letters, numbers, and hyphens only.',
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

    'hero.badge':         '🍽️ Restaurant OS — Für moderne Restaurants',
    'hero.title':         'Führe dein Restaurant,\nnicht deine Software',
    'hero.subtitle':      'Von Online-Reservierungen bis POS bis zur eigenen Website — alles auf einer Cloudflare-Plattform.',
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
    'feat.crm.desc':      'Gastprofile, Buchungshistorie, Notizen und Tags. Alles intern in deiner Datenbank — kein Odoo nötig.',
    'feat.crm.phase':     'Phase 4',

    'price.tag':          'Preise',
    'price.h2':           'Einfache, transparente Preise',
    'price.sub':          'Starte mit Core und wachse in das, was du brauchst. Keine versteckten Gebühren.',
    'price.popular':      'Beliebteste Wahl',
    'price.cta':          'Kostenlos starten',
    'price.cta_ent':      'Kontaktieren',
    'price.core_desc':    'Alles, was ein neues Restaurant zum Start braucht.',
    'price.com_desc':     'Volle Tisch-, Bestell- und Zahlungskontrolle.',
    'price.grow_desc':    'CRM, Treueprogramm und Marketing für wachsende Restaurants.',
    'price.ent_desc':     'Mehrere Standorte, individuelle Integrationen, dedizierter SLA-Support.',
    'price.core_f1':      'Restaurant-Website (3 Vorlagen)',
    'price.core_f2':      'Kontaktformular',
    'price.core_f3':      'Online-Buchungsformular',
    'price.core_f4':      'Buchungsbenachrichtigungen per E-Mail',
    'price.core_f5':      'Basis-Admin-Dashboard',
    'price.core_f6':      'Starter-Setup für den Website Builder',
    'price.com_f1':       'Alles aus Core',
    'price.com_f2':       'Vor-Ort-Buchungen + Walk-ins',
    'price.com_f3':       'Buchungs-Board + Status-Verwaltung',
    'price.com_f4':       'SMS-Benachrichtigungen + Mitarbeiter-PIN-App',
    'price.com_f5':       'POS + Zahlarten: Bar, PayPal, EC-/Debitkarte, Kreditkarte, Apple Pay',
    'price.com_f6':       'Stripe als optionales Gateway + TSE',
    'price.grow_f1':      'Alles aus Commerce',
    'price.grow_f2':      'CRM: Gastprofile + Buchungshistorie',
    'price.grow_f3':      'Treueprogramm',
    'price.grow_f4':      'Marketing-Automatisierung',
    'price.grow_f5':      'SEO-Tools',
    'price.ent_f1':       'Alles aus Growth',
    'price.ent_f2':       'Multi-Standort-Unterstützung',
    'price.ent_f3':       'Individuelle Integrations-API',
    'price.ent_f4':       'Dediziertes Onboarding + SLA',
    'price.per_mo':       '/Monat',
    'price.custom':       'Individuell',

    'footer.tagline':     'Restaurant OS — speziell für den modernen Restaurantbetrieb. Cloudflare-nativ, in Echtzeit, mandantenfähig.',
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
    'su.sub_label':       'Deine Restaurant OS-URL',
    'su.sub_hint':        'Diese URL sehen deine Gäste bei Online-Buchungen. Nur Kleinbuchstaben, Zahlen und Bindestriche.',
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

    'hero.badge':         '🍽️ Restaurant OS — Xây dựng cho nhà hàng hiện đại',
    'hero.title':         'Vận hành nhà hàng,\nkhông phải phần mềm',
    'hero.subtitle':      'Từ đặt bàn trực tuyến đến POS đến website riêng — tất cả những gì nhà hàng bạn cần, trên một nền tảng Cloudflare.',
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
    'feat.crm.desc':      'Hồ sơ khách, lịch sử đặt bàn, ghi chú và tag. Hoàn toàn nội bộ trong cơ sở dữ liệu của bạn — không cần Odoo.',
    'feat.crm.phase':     'Giai đoạn 4',

    'price.tag':          'Bảng giá',
    'price.h2':           'Giá đơn giản, minh bạch',
    'price.sub':          'Bắt đầu với Core và mở rộng theo nhu cầu. Không phí ẩn.',
    'price.popular':      'Phổ biến nhất',
    'price.cta':          'Bắt đầu dùng thử',
    'price.cta_ent':      'Liên hệ chúng tôi',
    'price.core_desc':    'Mọi thứ một nhà hàng mới cần để bắt đầu.',
    'price.com_desc':     'Kiểm soát hoàn toàn bàn, đơn hàng và thanh toán.',
    'price.grow_desc':    'CRM, chương trình thân thiết và marketing cho nhà hàng phát triển.',
    'price.ent_desc':     'Nhiều chi nhánh, tích hợp tùy chỉnh, hỗ trợ SLA chuyên biệt.',
    'price.core_f1':      'Website nhà hàng (3 mẫu)',
    'price.core_f2':      'Form liên hệ',
    'price.core_f3':      'Form đặt bàn online',
    'price.core_f4':      'Thông báo đặt bàn qua email',
    'price.core_f5':      'Dashboard quản trị cơ bản',
    'price.core_f6':      'Thiết lập khởi đầu cho website builder',
    'price.com_f1':       'Tất cả từ Core',
    'price.com_f2':       'Đặt bàn tại chỗ + walk-in',
    'price.com_f3':       'Bảng đặt bàn + quản lý giai đoạn',
    'price.com_f4':       'Thông báo SMS + app PIN cho nhân viên',
    'price.com_f5':       'POS + phương thức thanh toán: tiền mặt, PayPal, thẻ ghi nợ/tín dụng, Apple Pay',
    'price.com_f6':       'Stripe là một gateway tùy chọn + TSE',
    'price.grow_f1':      'Tất cả từ Commerce',
    'price.grow_f2':      'CRM: hồ sơ khách + lịch sử',
    'price.grow_f3':      'Chương trình khách hàng thân thiết',
    'price.grow_f4':      'Tự động hóa marketing',
    'price.grow_f5':      'Công cụ SEO',
    'price.ent_f1':       'Tất cả từ Growth',
    'price.ent_f2':       'Hỗ trợ nhiều chi nhánh',
    'price.ent_f3':       'API tích hợp tùy chỉnh',
    'price.ent_f4':       'Onboarding & SLA chuyên biệt',
    'price.per_mo':       '/tháng',
    'price.custom':       'Liên hệ',

    'footer.tagline':     'Restaurant OS — xây dựng riêng cho vận hành nhà hàng hiện đại. Cloudflare-native, thời gian thực, đa người dùng.',
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
    'su.sub_label':       'URL Restaurant OS của bạn',
    'su.sub_hint':        'Khách sẽ thấy URL này khi đặt bàn trực tuyến. Chỉ dùng chữ thường, số và dấu gạch ngang.',
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
}

function setLang(lang) {
  ROS_LANG = lang;
  localStorage.setItem('ros-lang', lang);
  applyLang();
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
    <li><a href="#" data-i18n="nav.login">Log in</a></li>
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
  const amount = Number(value || 0);
  return `€${amount.toFixed(0)}`;
}

async function loadPlatformPlans() {
  try {
    const res = await fetch('/api/platform/plans');
    const data = await res.json();
    if (res.ok && data.ok) {
      platformPlansData = data;
      applyPlatformPlansToPage();
      updateSignupPricingSummary();
    }
  } catch {
    // Keep static fallback content if API unavailable.
  }
}

function applyPlatformPlansToPage() {
  if (!platformPlansData?.plans) return;

  for (const plan of platformPlansData.plans) {
    const priceEls = document.querySelectorAll(`[data-plan-price="${plan.id}"]`);
    priceEls.forEach((el) => {
      if (plan.priceEurPerUserMonthly == null) {
        el.textContent = t('price.custom');
        return;
      }
      el.innerHTML = `${euro(plan.priceEurPerUserMonthly)}<span class="mo">/user/mo</span>`;
    });
  }

  const setupEl = document.getElementById('platform-extra-setup');
  const tseEl = document.getElementById('platform-extra-tse');
  const supportEl = document.getElementById('platform-extra-support');
  const noteEl = document.getElementById('platform-pricing-note');
  if (setupEl) setupEl.textContent = `${euro(platformPlansData.extras?.oneTimeSetupFeeEur)} one-time setup`;
  if (tseEl) tseEl.textContent = `${euro(platformPlansData.extras?.tseMonthlyFeeEur)}/month TSE package`;
  if (supportEl) supportEl.textContent = `${euro(platformPlansData.extras?.itSupportHourlyEur)}/hour IT support or ${euro(platformPlansData.extras?.itSupportMonthlyRetainerEur)}/month retainer`;
  if (noteEl) noteEl.textContent = platformPlansData.pricingNote || '';
}

function getSelectedPlanData() {
  return platformPlansData?.plans?.find((plan) => plan.id === state.plan) || null;
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
      summaryEl.innerHTML = `<div class="alert alert-info">Enterprise pricing is handled manually via contact.</div>`;
    });
    return;
  }

  const base = Number(plan.priceEurPerUserMonthly) * users;
  const setup = includeSetup ? Number(platformPlansData.extras.oneTimeSetupFeeEur || 0) : 0;
  const tse = includeTse ? Number(platformPlansData.extras.tseMonthlyFeeEur || 0) : 0;
  const support = includeSupport ? Number(platformPlansData.extras.itSupportMonthlyRetainerEur || 0) : 0;

  summaryEls.forEach((summaryEl) => {
    summaryEl.innerHTML = `
      <div class="alert alert-info" style="margin-top:6px;">
        <strong>Demo payment review</strong><br>
        Plan: ${plan.name}<br>
        Active staff users: ${users}<br>
        Recurring monthly estimate: ${euro(base + tse + support)}<br>
        Due today in demo mode: ${euro(setup)}
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
        Due today: <strong>${euro(data.payment?.dueTodayEur || 0)}</strong><br>
        Recurring monthly: <strong>${euro(data.payment?.recurringMonthlyEur || 0)}</strong><br><br>
        Preview admin: <a href="${data.preview_admin_url}" target="_blank" rel="noopener">open admin</a><br>
        Preview board: <a href="${data.preview_board_url}" target="_blank" rel="noopener">open board</a><br>
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
  applyLang();
  loadPlatformPlans();

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
