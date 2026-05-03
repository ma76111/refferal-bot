export const languages = {
  ar: {
    // القائمة الرئيسية
    available_tasks: '📋 المهام المتاحة',
    add_task: '➕ إضافة مهمة',
    my_balance: '💰 محفظتي',
    my_tasks: '📊 مهامي',
    deposit_usdt: '💳 إيداع USDT',
    review_tasks: '✅ مراجعة المهام',
    help: '⚙️ المساعدة',
    support: '💬 الدعم',
    my_id: '🆔 معرفي',
    language: '🌐 اللغة',
    admin_panel: '⚙️ لوحة التحكم',
    
    // رسائل الترحيب
    welcome: (name) => `مرحباً ${name}! 👋\n\n🤖 هذا بوت تبادل الإحالات والمهام المدفوعة\n\n📋 يمكنك:\n• تنفيذ مهام وكسب المال\n• إضافة مهام لبوتك الخاص\n• تبادل الإحالات مع الآخرين\n\nاستخدم القائمة أدناه للبدء 👇`,
    
    // المحفظة
    current_balance: (balance) => `💰 محفظتك الحالية: ${balance} USDT`,
    
    // المعرف
    your_id: (id) => `🆔 معرفك: \`${id}\``,
    
    // الدعم
    support_message: 'سيتم تحديثه من لوحة التحكم',
    
    // الإيداع
    deposit_title: '💳 إيداع USDT',
    min_deposit: '💰 الحد الأدنى للإيداع: 0.1 USDT',
    choose_method: 'اختر طريقة الإيداع:',
    binance_id_method: '🆔 Binance ID',
    wallet_method: '💼 عنوان المحفظة',
    cancel: '❌ إلغاء',
    
    // الأزرار
    back_to_menu: '🔙 رجوع للقائمة الرئيسية',
    
    // لوحة التحكم
    admin_panel_title: '⚙️ لوحة تحكم الأدمن',
    review_deposits: '💵 مراجعة الإيداعات',
    manage_users: '👥 إدارة المستخدمين',
    search_user: '🔍 البحث عن مستخدم',
    edit_support_text: '✏️ تعديل نص الدعم',
    change_max_count: '🔧 تغيير الحد الأقصى',
    change_max_tasks: '📝 حد المهام للمستخدم',
    back: '🔙 رجوع'
  },
  
  en: {
    // Main Menu
    available_tasks: '📋 Available Tasks',
    add_task: '➕ Add Task',
    my_balance: '💰 My Wallet',
    my_tasks: '📊 My Tasks',
    deposit_usdt: '💳 Deposit USDT',
    review_tasks: '✅ Review Tasks',
    help: '⚙️ Help',
    support: '💬 Support',
    my_id: '🆔 My ID',
    language: '🌐 Language',
    admin_panel: '⚙️ Admin Panel',
    
    // Welcome Messages
    welcome: (name) => `Welcome ${name}! 👋\n\n🤖 This is a referral exchange and paid tasks bot\n\n📋 You can:\n• Complete tasks and earn money\n• Add tasks for your own bot\n• Exchange referrals with others\n\nUse the menu below to get started 👇`,
    
    // Balance
    current_balance: (balance) => `💰 Your current wallet: ${balance} USDT`,
    
    // ID
    your_id: (id) => `🆔 Your ID: \`${id}\``,
    
    // Support
    support_message: 'Will be updated from admin panel',
    
    // Deposit
    deposit_title: '💳 Deposit USDT',
    min_deposit: '💰 Minimum deposit: 0.1 USDT',
    choose_method: 'Choose deposit method:',
    binance_id_method: '🆔 Binance ID',
    wallet_method: '💼 Wallet Address',
    cancel: '❌ Cancel',
    
    // Buttons
    back_to_menu: '🔙 Back to Main Menu',
    
    // Admin Panel
    admin_panel_title: '⚙️ Admin Control Panel',
    review_deposits: '💵 Review Deposits',
    manage_users: '👥 Manage Users',
    search_user: '🔍 Search User',
    edit_support_text: '✏️ Edit Support Text',
    change_max_count: '🔧 Change Max Count',
    change_max_tasks: '📝 Max Tasks Per User',
    back: '🔙 Back'
  },
  
  ru: {
    // Главное меню
    available_tasks: '📋 Доступные задачи',
    add_task: '➕ Добавить задачу',
    my_balance: '💰 Мой кошелек',
    my_tasks: '📊 Мои задачи',
    deposit_usdt: '💳 Пополнить USDT',
    review_tasks: '✅ Проверить задачи',
    help: '⚙️ Помощь',
    support: '💬 Поддержка',
    my_id: '🆔 Мой ID',
    language: '🌐 Язык',
    admin_panel: '⚙️ Панель управления',
    
    // Приветственные сообщения
    welcome: (name) => `Добро пожаловать ${name}! 👋\n\n🤖 Это бот для обмена рефералами и платных задач\n\n📋 Вы можете:\n• Выполнять задачи и зарабатывать деньги\n• Добавлять задачи для своего бота\n• Обмениваться рефералами с другими\n\nИспользуйте меню ниже для начала 👇`,
    
    // Баланс
    current_balance: (balance) => `💰 Ваш текущий кошелек: ${balance} USDT`,
    
    // ID
    your_id: (id) => `🆔 Ваш ID: \`${id}\``,
    
    // Поддержка
    support_message: 'Будет обновлено из панели администратора',
    
    // Пополнение
    deposit_title: '💳 Пополнить USDT',
    min_deposit: '💰 Минимальный депозит: 0.1 USDT',
    choose_method: 'Выберите способ пополнения:',
    binance_id_method: '🆔 Binance ID',
    wallet_method: '💼 Адрес кошелька',
    cancel: '❌ Отмена',
    
    // Кнопки
    back_to_menu: '🔙 Вернуться в главное меню',
    
    // Панель администратора
    admin_panel_title: '⚙️ Панель управления администратора',
    review_deposits: '💵 Проверить депозиты',
    manage_users: '👥 Управление пользователями',
    search_user: '🔍 Поиск пользователя',
    edit_support_text: '✏️ Изменить текст поддержки',
    change_max_count: '🔧 Изменить максимум',
    change_max_tasks: '📝 Макс. задач на пользователя',
    back: '🔙 Назад'
  }
};

export function getText(lang, key, ...args) {
  const text = languages[lang]?.[key] || languages['ar'][key];
  return typeof text === 'function' ? text(...args) : text;
}
