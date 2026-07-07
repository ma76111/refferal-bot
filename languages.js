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
    back: '🔙 رجوع',

    // الإشعارات المخصصة
    notification_settings: '🔔 إعدادات الإشعارات',
    notif_submission_accepted: 'قبول التقديم',
    notif_submission_rejected: 'رفض التقديم',
    notif_task_completed: 'اكتمال المهمة',
    notif_promotional: 'العروض الترويجية',
    notif_system_update: 'تحديثات النظام',
    notif_enabled: '✅ مفعّل',
    notif_disabled: '❌ معطّل',
    notif_saved: '✅ تم حفظ إعدادات الإشعارات',

    // الدعم - تذاكر
    support_title: '🎫 نظام الدعم',
    support_new_ticket: '➕ تذكرة جديدة',
    support_my_tickets: '📋 تذاكري',
    support_ticket_created: (no) => `✅ تم إنشاء تذكرتك رقم: ${no}`,
    support_ticket_reply: (no, msg) => `📩 رد على تذكرة #${no}:\n\n${msg}`,
    support_enter_subject: 'أدخل موضوع المشكلة:',
    support_enter_message: 'أدخل رسالتك:',
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
    back: '🔙 Back',

    // Custom Notifications
    notification_settings: '🔔 Notification Settings',
    notif_submission_accepted: 'Submission Accepted',
    notif_submission_rejected: 'Submission Rejected',
    notif_task_completed: 'Task Completed',
    notif_promotional: 'Promotions',
    notif_system_update: 'System Updates',
    notif_enabled: '✅ Enabled',
    notif_disabled: '❌ Disabled',
    notif_saved: '✅ Notification settings saved',

    // Support Tickets
    support_title: '🎫 Support System',
    support_new_ticket: '➕ New Ticket',
    support_my_tickets: '📋 My Tickets',
    support_ticket_created: (no) => `✅ Your ticket has been created: ${no}`,
    support_ticket_reply: (no, msg) => `📩 Reply to ticket #${no}:\n\n${msg}`,
    support_enter_subject: 'Enter the issue subject:',
    support_enter_message: 'Enter your message:',
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
    back: '🔙 Назад',

    // Настройки уведомлений
    notification_settings: '🔔 Настройки уведомлений',
    notif_submission_accepted: 'Заявка принята',
    notif_submission_rejected: 'Заявка отклонена',
    notif_task_completed: 'Задание выполнено',
    notif_promotional: 'Акции',
    notif_system_update: 'Обновления системы',
    notif_enabled: '✅ Включено',
    notif_disabled: '❌ Отключено',
    notif_saved: '✅ Настройки уведомлений сохранены',

    // Тикеты поддержки
    support_title: '🎫 Система поддержки',
    support_new_ticket: '➕ Новый тикет',
    support_my_tickets: '📋 Мои тикеты',
    support_ticket_created: (no) => `✅ Ваш тикет создан: ${no}`,
    support_ticket_reply: (no, msg) => `📩 Ответ на тикет #${no}:\n\n${msg}`,
    support_enter_subject: 'Введите тему проблемы:',
    support_enter_message: 'Введите ваше сообщение:',
  }
};

// اللغة الفارسية
languages.fa = {
  available_tasks: '📋 وظایف موجود',
  add_task: '➕ افزودن وظیفه',
  my_balance: '💰 کیف پول من',
  my_tasks: '📊 وظایف من',
  deposit_usdt: '💳 واریز USDT',
  review_tasks: '✅ بررسی وظایف',
  help: '⚙️ راهنما',
  support: '💬 پشتیبانی',
  my_id: '🆔 شناسه من',
  language: '🌐 زبان',
  admin_panel: '⚙️ پنل مدیریت',
  welcome: (name) => `سلام ${name}! 👋\n\n🤖 این ربات تبادل ارجاع و وظایف پولی است\n\n📋 می‌توانید:\n• وظایف را انجام دهید و درآمد کسب کنید\n• وظایف برای ربات خود اضافه کنید\n• ارجاعات را با دیگران تبادل کنید\n\nاز منوی زیر شروع کنید 👇`,
  current_balance: (balance) => `💰 کیف پول فعلی شما: ${balance} USDT`,
  your_id: (id) => `🆔 شناسه شما: \`${id}\``,
  support_message: 'از پنل مدیریت به‌روز می‌شود',
  deposit_title: '💳 واریز USDT',
  min_deposit: '💰 حداقل واریز: 0.1 USDT',
  choose_method: 'روش واریز را انتخاب کنید:',
  binance_id_method: '🆔 Binance ID',
  wallet_method: '💼 آدرس کیف پول',
  cancel: '❌ لغو',
  back_to_menu: '🔙 بازگشت به منوی اصلی',
  admin_panel_title: '⚙️ پنل کنترل ادمین',
  review_deposits: '💵 بررسی واریزها',
  manage_users: '👥 مدیریت کاربران',
  search_user: '🔍 جستجوی کاربر',
  edit_support_text: '✏️ ویرایش متن پشتیبانی',
  change_max_count: '🔧 تغییر حداکثر',
  change_max_tasks: '📝 حداکثر وظایف هر کاربر',
  back: '🔙 بازگشت',
  notification_settings: '🔔 تنظیمات اعلان',
  notif_submission_accepted: 'درخواست پذیرفته شد',
  notif_submission_rejected: 'درخواست رد شد',
  notif_task_completed: 'وظیفه کامل شد',
  notif_promotional: 'تبلیغات',
  notif_system_update: 'به‌روزرسانی سیستم',
  notif_enabled: '✅ فعال',
  notif_disabled: '❌ غیرفعال',
  notif_saved: '✅ تنظیمات اعلان ذخیره شد',
  support_title: '🎫 سیستم پشتیبانی',
  support_new_ticket: '➕ تیکت جدید',
  support_my_tickets: '📋 تیکت‌های من',
  support_ticket_created: (no) => `✅ تیکت شما ایجاد شد: ${no}`,
  support_ticket_reply: (no, msg) => `📩 پاسخ به تیکت #${no}:\n\n${msg}`,
  support_enter_subject: 'موضوع مشکل را وارد کنید:',
  support_enter_message: 'پیام خود را وارد کنید:',
};

// اللغة التركية
languages.tr = {
  available_tasks: '📋 Mevcut Görevler',
  add_task: '➕ Görev Ekle',
  my_balance: '💰 Cüzdanım',
  my_tasks: '📊 Görevlerim',
  deposit_usdt: '💳 USDT Yatır',
  review_tasks: '✅ Görevleri İncele',
  help: '⚙️ Yardım',
  support: '💬 Destek',
  my_id: '🆔 Kimliğim',
  language: '🌐 Dil',
  admin_panel: '⚙️ Yönetici Paneli',
  welcome: (name) => `Merhaba ${name}! 👋\n\n🤖 Bu, yönlendirme değişimi ve ücretli görevler botudur\n\n📋 Yapabilecekleriniz:\n• Görevleri tamamlayın ve para kazanın\n• Kendi botunuz için görevler ekleyin\n• Diğerleriyle yönlendirme değişimi yapın\n\nBaşlamak için aşağıdaki menüyü kullanın 👇`,
  current_balance: (balance) => `💰 Mevcut cüzdanınız: ${balance} USDT`,
  your_id: (id) => `🆔 Kimliğiniz: \`${id}\``,
  support_message: 'Yönetici panelinden güncellenecek',
  deposit_title: '💳 USDT Yatır',
  min_deposit: '💰 Minimum para yatırma: 0.1 USDT',
  choose_method: 'Para yatırma yöntemini seçin:',
  binance_id_method: '🆔 Binance ID',
  wallet_method: '💼 Cüzdan Adresi',
  cancel: '❌ İptal',
  back_to_menu: '🔙 Ana Menüye Dön',
  admin_panel_title: '⚙️ Yönetici Kontrol Paneli',
  review_deposits: '💵 Yatırımları İncele',
  manage_users: '👥 Kullanıcıları Yönet',
  search_user: '🔍 Kullanıcı Ara',
  edit_support_text: '✏️ Destek Metnini Düzenle',
  change_max_count: '🔧 Maksimumu Değiştir',
  change_max_tasks: '📝 Kullanıcı Başına Maks. Görev',
  back: '🔙 Geri',
  notification_settings: '🔔 Bildirim Ayarları',
  notif_submission_accepted: 'Başvuru Kabul Edildi',
  notif_submission_rejected: 'Başvuru Reddedildi',
  notif_task_completed: 'Görev Tamamlandı',
  notif_promotional: 'Promosyonlar',
  notif_system_update: 'Sistem Güncellemeleri',
  notif_enabled: '✅ Etkin',
  notif_disabled: '❌ Devre Dışı',
  notif_saved: '✅ Bildirim ayarları kaydedildi',
  support_title: '🎫 Destek Sistemi',
  support_new_ticket: '➕ Yeni Talep',
  support_my_tickets: '📋 Taleplerim',
  support_ticket_created: (no) => `✅ Talebiniz oluşturuldu: ${no}`,
  support_ticket_reply: (no, msg) => `📩 #${no} talebine yanıt:\n\n${msg}`,
  support_enter_subject: 'Sorunun konusunu girin:',
  support_enter_message: 'Mesajınızı girin:',
};

// اللغة الأوردو
languages.ur = {
  available_tasks: '📋 دستیاب کام',
  add_task: '➕ کام شامل کریں',
  my_balance: '💰 میرا بٹوہ',
  my_tasks: '📊 میرے کام',
  deposit_usdt: '💳 USDT جمع کریں',
  review_tasks: '✅ کام جائزہ لیں',
  help: '⚙️ مدد',
  support: '💬 سپورٹ',
  my_id: '🆔 میری ID',
  language: '🌐 زبان',
  admin_panel: '⚙️ ایڈمن پینل',
  welcome: (name) => `السلام علیکم ${name}! 👋\n\n🤖 یہ ریفرل ایکسچینج اور ادا شدہ کاموں کا بوٹ ہے\n\n📋 آپ کر سکتے ہیں:\n• کام مکمل کریں اور پیسے کمائیں\n• اپنے بوٹ کے لیے کام شامل کریں\n• دوسروں کے ساتھ ریفرل تبادلہ کریں\n\nشروع کرنے کے لیے نیچے مینو استعمال کریں 👇`,
  current_balance: (balance) => `💰 آپ کا موجودہ بٹوہ: ${balance} USDT`,
  your_id: (id) => `🆔 آپ کی ID: \`${id}\``,
  support_message: 'ایڈمن پینل سے اپ ڈیٹ کیا جائے گا',
  deposit_title: '💳 USDT جمع کریں',
  min_deposit: '💰 کم از کم جمع: 0.1 USDT',
  choose_method: 'جمع کرنے کا طریقہ منتخب کریں:',
  binance_id_method: '🆔 Binance ID',
  wallet_method: '💼 بٹوے کا پتہ',
  cancel: '❌ منسوخ',
  back_to_menu: '🔙 مرکزی مینو پر واپس',
  admin_panel_title: '⚙️ ایڈمن کنٹرول پینل',
  review_deposits: '💵 جمع جائزہ لیں',
  manage_users: '👥 صارفین منظم کریں',
  search_user: '🔍 صارف تلاش کریں',
  edit_support_text: '✏️ سپورٹ متن ترمیم کریں',
  change_max_count: '🔧 زیادہ سے زیادہ تبدیل کریں',
  change_max_tasks: '📝 ہر صارف کے لیے زیادہ سے زیادہ کام',
  back: '🔙 واپس',
  notification_settings: '🔔 اطلاع کی ترتیبات',
  notif_submission_accepted: 'جمع قبول',
  notif_submission_rejected: 'جمع مسترد',
  notif_task_completed: 'کام مکمل',
  notif_promotional: 'پروموشنز',
  notif_system_update: 'سسٹم اپ ڈیٹس',
  notif_enabled: '✅ فعال',
  notif_disabled: '❌ غیر فعال',
  notif_saved: '✅ اطلاع کی ترتیبات محفوظ',
  support_title: '🎫 سپورٹ سسٹم',
  support_new_ticket: '➕ نیا ٹکٹ',
  support_my_tickets: '📋 میرے ٹکٹس',
  support_ticket_created: (no) => `✅ آپ کا ٹکٹ بنایا گیا: ${no}`,
  support_ticket_reply: (no, msg) => `📩 ٹکٹ #${no} کا جواب:\n\n${msg}`,
  support_enter_subject: 'مسئلے کا موضوع درج کریں:',
  support_enter_message: 'اپنا پیغام درج کریں:',
};

export function getText(lang, key, ...args) {
  const text = languages[lang]?.[key] ?? languages['ar'][key];
  return typeof text === 'function' ? text(...args) : (text ?? key);
}
