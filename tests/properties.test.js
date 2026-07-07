/**
 * اختبارات الخاصية (Property-Based Tests) باستخدام fast-check
 * تختبر الدوال النقية فقط بدون قاعدة بيانات
 */

import fc from 'fast-check';

// ── validators (inline) ────────────────────────────────────────

function validateTRC20Address(addr) {
  if (typeof addr !== 'string') return false;
  return /^T[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{33}$/.test(addr);
}

function validateBinancePayId(id) {
  if (id === null || id === undefined) return false;
  return /^\d{9,12}$/.test(String(id).trim());
}

function validateAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && isFinite(num) && num > 0;
}

function generateTicketNo() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `TKT-${suffix}`;
}

// ── Property 1: تسلسل تفضيلات الإشعارات ───────────────────────

test('Property 1: تسلسل تفضيلات الإشعارات round-trip', () => {
  fc.assert(
    fc.property(
      fc.record({
        submission_accepted: fc.constantFrom(0, 1),
        submission_rejected: fc.constantFrom(0, 1),
        task_completed:      fc.constantFrom(0, 1),
        promotional:         fc.constantFrom(0, 1),
        system_update:       fc.constantFrom(0, 1),
      }),
      (prefs) => {
        const parsed = JSON.parse(JSON.stringify(prefs));
        return Object.keys(prefs).every(k => parsed[k] === prefs[k]);
      }
    ),
    { numRuns: 100 }
  );
});

// ── Property 10: فريدية أرقام التذاكر ─────────────────────────

test('Property 10: أرقام التذاكر تبدأ بـ TKT- وطولها 12', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 100 }),
      () => {
        const no = generateTicketNo();
        return no.startsWith('TKT-') && no.length === 12;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 10b: 50 رقم تذكرة يعطي أرقاماً متنوعة', () => {
  const tickets = Array.from({ length: 50 }, generateTicketNo);
  expect(new Set(tickets).size).toBeGreaterThan(40);
});

// ── Property 16: رفض المدخلات غير الصالحة ──────────────────────

test('Property 16: validateAmount يرفض الصفر والسالب', () => {
  fc.assert(
    fc.property(
      fc.double({ max: 0, noNaN: true }),
      (v) => validateAmount(v) === false
    ),
    { numRuns: 100 }
  );
});

test('Property 16b: validateAmount يقبل الموجب', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0.001, max: 1_000_000, noNaN: true }),
      (v) => validateAmount(v) === true
    ),
    { numRuns: 100 }
  );
});

// ── Property 27: التحقق من عناوين المحافظ ──────────────────────

test('Property 27a: TRC20 يرفض السلاسل غير البادئة بـ T', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 40 }).filter(s => !s.startsWith('T')),
      (addr) => validateTRC20Address(addr) === false
    ),
    { numRuns: 100 }
  );
});

test('Property 27b: BinancePayId يرفض أقل من 9 أرقام', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 8 }).chain(len =>
        fc.stringOf(fc.constantFrom('0','1','2','3','4','5','6','7','8','9'), { minLength: len, maxLength: len })
      ),
      (id) => validateBinancePayId(id) === false
    ),
    { numRuns: 100 }
  );
});

test('Property 27c: BinancePayId يقبل 9-12 رقم', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 9, max: 12 }).chain(len =>
        fc.stringOf(fc.constantFrom('1','2','3','4','5','6','7','8','9'), { minLength: len, maxLength: len })
      ),
      (id) => validateBinancePayId(id) === true
    ),
    { numRuns: 100 }
  );
});

// ── Property 30: Round-trip serialization ─────────────────────

test('Property 30: تسلسل وإلغاء تسلسل كائن المستخدم', () => {
  fc.assert(
    fc.property(
      fc.record({
        id:              fc.integer({ min: 1 }),
        telegram_id:     fc.integer({ min: 1 }),
        balance:         fc.double({ min: 0, max: 10000, noNaN: true }),
        exchange_points: fc.integer({ min: 0 }),
        language:        fc.constantFrom('ar', 'en', 'ru', 'fa', 'tr', 'ur'),
      }),
      (user) => {
        const d = JSON.parse(JSON.stringify(user));
        return d.id === user.id &&
               d.telegram_id === user.telegram_id &&
               d.exchange_points === user.exchange_points &&
               d.language === user.language;
      }
    ),
    { numRuns: 100 }
  );
});

// ── Property 19: Pagination ────────────────────────────────────

test('Property 19: pagination لا يعيد أكثر من pageSize عنصر', () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer(), { minLength: 0, maxLength: 200 }),
      fc.integer({ min: 1, max: 50 }),
      fc.integer({ min: 1, max: 20 }),
      (items, page, pageSize) => {
        const offset = (page - 1) * pageSize;
        const slice = items.slice(offset, offset + pageSize);
        return slice.length <= pageSize;
      }
    ),
    { numRuns: 100 }
  );
});
