// Key rebinding rules (Ticket-04 section 4). Pure functions so they can be tested without a browser.
export const ACTIONS = [
  { id: 'forward', label: 'Đi tới' },
  { id: 'back', label: 'Đi lùi' },
  { id: 'left', label: 'Sang trái' },
  { id: 'right', label: 'Sang phải' },
  { id: 'jump', label: 'Nhảy' },
  { id: 'dash', label: 'Lướt' },
  { id: 'interact', label: 'Nạp đèn / châm dầu' },
  { id: 'pulse', label: 'Tỏa Sáng' },
  { id: 'pause', label: 'Tạm dừng' },
];

export const DEFAULT_KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'Escape',
};

// Fixed keys that cannot be given to an action: camera, restart and confirm.
export const RESERVED = { ArrowLeft: 'xoay camera trái', ArrowRight: 'xoay camera phải', KeyR: 'chơi lại Đêm', Enter: 'xác nhận' };

const NAMES = {
  Space: 'Space', Escape: 'Esc', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải',
  AltLeft: 'Alt trái', AltRight: 'Alt phải', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab',
  Backspace: 'Backspace', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Minus: '-', Equal: '=', Backquote: '`', Backslash: '\\',
};

/** Human-readable name of a KeyboardEvent.code. */
export function keyLabel(code) {
  if (NAMES[code]) return NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return `Num ${code.slice(6)}`;
  return code;
}

/** Which action (other than `except`) already uses this key, or null. */
export function conflictOf(keys, code, except) {
  for (const a of ACTIONS) if (a.id !== except && keys[a.id] === code) return a.id;
  return null;
}

/**
 * Tries to bind `code` to `action`. Never mutates `keys`.
 * Returns { ok: true, keys } or { ok: false, reason, with } where `with` names the clashing action label or fixed use.
 */
export function assignKey(keys, action, code) {
  if (!ACTIONS.some((a) => a.id === action)) return { ok: false, reason: 'unknown', with: action };
  if (typeof code !== 'string' || !code) return { ok: false, reason: 'invalid', with: '' };
  if (RESERVED[code]) return { ok: false, reason: 'reserved', with: RESERVED[code] };
  const other = conflictOf(keys, code, action);
  if (other) return { ok: false, reason: 'conflict', with: ACTIONS.find((a) => a.id === other).label };
  return { ok: true, keys: { ...keys, [action]: code } };
}

/** Validates keys read from storage: anything missing, duplicated or reserved falls back to the defaults. */
export function normalizeKeys(stored) {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_KEYS };
  const keys = {};
  for (const a of ACTIONS) keys[a.id] = typeof stored[a.id] === 'string' && stored[a.id] ? stored[a.id] : DEFAULT_KEYS[a.id];
  const codes = Object.values(keys);
  const dup = new Set(codes).size !== codes.length || codes.some((c) => RESERVED[c]);
  return dup ? { ...DEFAULT_KEYS } : keys;
}

/** Every pair of actions that share a key (empty when the map is valid). */
export function findDuplicates(keys) {
  const seen = new Map(), out = [];
  for (const a of ACTIONS) {
    const c = keys[a.id];
    if (seen.has(c)) out.push([seen.get(c), a.id]); else seen.set(c, a.id);
  }
  return out;
}
