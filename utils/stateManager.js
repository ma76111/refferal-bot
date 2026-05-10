/**
 * مدير الحالات المركزي
 * يوفر دوال مساعدة لإدارة حالات المستخدمين والأدمن
 */

// قائمة أزرار القائمة الرئيسية بجميع اللغات
const MAIN_MENU_BUTTONS = [
  // العربية
  '➕ إضافة مهمة', '📋 المهام المتاحة', '📊 مهامي', '💰 محفظتي',
  '💳 إيداع', '💸 سحب', '⭐ تقييماتي', '🌐 تغيير اللغة',
  '📞 الدعم', '📖 طريقة العمل', '⚙️ لوحة التحكم',
  // English
  '➕ Add Task', '📋 Available Tasks', '📊 My Tasks', '💰 My Wallet',
  '💳 Deposit', '💸 Withdraw', '⭐ My Ratings', '🌐 Change Language',
  '📞 Support', '📖 How It Works', '⚙️ Admin Panel',
  // Русский
  '➕ Добавить задачу', '📋 Доступные задачи', '📊 Мои задачи', '💰 Мой кошелек',
  '💳 Пополнить', '💸 Вывести', '⭐ Мои рейтинги', '🌐 Изменить язык',
  '📞 Поддержка', '📖 Как это работает', '⚙️ Панель администратора'
];

// قائمة أزرار لوحة التحكم
const ADMIN_PANEL_BUTTONS = [
  '✅ مراجعة المهام', '💵 مراجعة الإيداعات', '💸 مراجعة السحوبات',
  '🔍 البحث عن مستخدم', '✏️ تعديل نص الدعم', '🔧 تغيير الحد الأقصى للأشخاص',
  '📝 تغيير حد المهام للمستخدم', '⏱️ تغيير وقت المهلة', '🔄 تغيير مهلة التحسين',
  '💰 تغيير الحد الأدنى للمكافأة', '💸 تغيير الحد الأدنى للسحب', '📊 الإحصائيات',
  '📢 رسالة جماعية', '📋 الاستئنافات', '👥 إدارة الأدمنز', '🗑️ حذف مهمة', '🔙 رجوع'
];

/**
 * التحقق من أن النص المرسل هو زر من القائمة الرئيسية
 * @param {string} text - النص المرسل من المستخدم
 * @returns {boolean}
 */
export function isMainMenuButton(text) {
  return MAIN_MENU_BUTTONS.includes(text);
}

/**
 * التحقق من أن النص المرسل هو زر من لوحة التحكم
 * @param {string} text - النص المرسل من الأدمن
 * @returns {boolean}
 */
export function isAdminPanelButton(text) {
  return ADMIN_PANEL_BUTTONS.includes(text);
}

/**
 * التحقق من أن النص المرسل هو زر إلغاء
 * @param {string} text - النص المرسل
 * @returns {boolean}
 */
export function isCancelButton(text) {
  return ['❌ إلغاء', '❌ Cancel', '❌ Отмена'].includes(text);
}

/**
 * معالجة تلقائية لإلغاء الحالة عند الضغط على أزرار القائمة
 * @param {Map} stateMap - خريطة الحالات
 * @param {number} chatId - معرف المحادثة
 * @param {string} text - النص المرسل
 * @param {boolean} isAdmin - هل المستخدم أدمن
 * @returns {boolean} true إذا تم إلغاء الحالة، false إذا يجب متابعة المعالجة
 */
export function handleStateInterruption(stateMap, chatId, text, isAdmin = false) {
  const state = stateMap.get(chatId);
  if (!state) return false;

  // التحقق من أزرار القائمة
  const isMenuButton = isMainMenuButton(text) || (isAdmin && isAdminPanelButton(text));
  
  if (isMenuButton) {
    // إلغاء الحالة والسماح بمعالجة الزر الجديد
    stateMap.delete(chatId);
    return true; // تم إلغاء الحالة، يجب إرجاع false من المعالج للسماح بمعالجة الزر
  }
  
  return false;
}

export default {
  isMainMenuButton,
  isAdminPanelButton,
  isCancelButton,
  handleStateInterruption
};
