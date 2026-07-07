/**
 * التحقق من صحة عنوان TRC20 (TRON)
 * يبدأ بـ T ويتبعه 33 حرف من Base58
 * @param {string} addr
 * @returns {boolean}
 */
export function validateTRC20Address(addr) {
  if (typeof addr !== 'string') return false;
  // Base58 characters: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  const base58Chars = /^T[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{33}$/;
  return base58Chars.test(addr);
}

/**
 * التحقق من صحة عنوان TON
 * يبدأ بـ UQ أو EQ أو -1: ويتبعه أحرف Base64url
 * @param {string} addr
 * @returns {boolean}
 */
export function validateTONAddress(addr) {
  if (typeof addr !== 'string') return false;
  // الصيغة المألوفة: UQxxxx أو EQxxxx (48 حرف إجمالاً) أو raw form
  const userFriendly = /^[UE]Q[A-Za-z0-9_-]{46}$/;
  const rawForm = /^-?[0-9]+:[A-Fa-f0-9]{64}$/;
  return userFriendly.test(addr) || rawForm.test(addr);
}

/**
 * التحقق من صحة معرف Binance Pay
 * رقم مؤلف من 9 إلى 12 خانة
 * @param {string|number} id
 * @returns {boolean}
 */
export function validateBinancePayId(id) {
  if (id === null || id === undefined) return false;
  const str = String(id).trim();
  return /^\d{9,12}$/.test(str);
}

/**
 * التحقق من صحة المبلغ (موجب وأكبر من 0)
 * @param {string|number} amount
 * @returns {boolean}
 */
export function validateAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && isFinite(num) && num > 0;
}
