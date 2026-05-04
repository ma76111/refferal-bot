export const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📋 المهام المتاحة', '➕ إضافة مهمة'],
      ['ℹ️ معلوماتي', '📊 مهامي'],
      ['💳 إيداع USDT', '💸 سحب USDT'],
      ['💬 الدعم', '🌐 اللغة']
    ],
    resize_keyboard: true
  }
};

export const adminMenu = {
  reply_markup: {
    keyboard: [
      ['📋 المهام المتاحة', '➕ إضافة مهمة'],
      ['ℹ️ معلوماتي', '📊 مهامي'],
      ['💳 إيداع USDT', '💸 سحب USDT'],
      ['💬 الدعم', '🌐 اللغة'],
      ['⚙️ لوحة التحكم']
    ],
    resize_keyboard: true
  }
};

export const getTaskTypeKeyboard = (lang = 'ar') => {
  const texts = {
    ar: {
      paid: '💵 مهمة مدفوعة',
      exchange: '🔄 تبادل إحالات',
      cancel: '❌ إلغاء'
    },
    en: {
      paid: '💵 Paid Task',
      exchange: '🔄 Referral Exchange',
      cancel: '❌ Cancel'
    },
    ru: {
      paid: '💵 Платная задача',
      exchange: '🔄 Обмен рефералами',
      cancel: '❌ Отмена'
    }
  };

  const t = texts[lang] || texts.ar;

  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: t.paid, callback_data: 'task_type_paid' }],
        [{ text: t.exchange, callback_data: 'task_type_exchange' }],
        [{ text: t.cancel, callback_data: 'cancel' }]
      ]
    }
  };
};

// Keep old export for backward compatibility
export const taskTypeKeyboard = getTaskTypeKeyboard('ar');

export const getProofTypeKeyboard = (lang = 'ar') => {
  const texts = {
    ar: {
      text: '📝 نص فقط',
      images: '🖼 صور فقط',
      both: '📝🖼 نص + صور',
      cancel: '❌ إلغاء'
    },
    en: {
      text: '📝 Text Only',
      images: '🖼 Images Only',
      both: '📝🖼 Text + Images',
      cancel: '❌ Cancel'
    },
    ru: {
      text: '📝 Только текст',
      images: '🖼 Только изображения',
      both: '📝🖼 Текст + изображения',
      cancel: '❌ Отмена'
    }
  };

  const t = texts[lang] || texts.ar;

  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: t.text, callback_data: 'proof_text' }],
        [{ text: t.images, callback_data: 'proof_images' }],
        [{ text: t.both, callback_data: 'proof_both' }],
        [{ text: t.cancel, callback_data: 'cancel' }]
      ]
    }
  };
};

// Keep old export for backward compatibility
export const proofTypeKeyboard = getProofTypeKeyboard('ar');

export const reviewKeyboard = (submissionId) => ({
  reply_markup: {
    inline_keyboard: [
      [
        { text: '✅ قبول', callback_data: `review_accept_${submissionId}` },
        { text: '❌ رفض', callback_data: `review_reject_${submissionId}` }
      ]
    ]
  }
});

export const cancelKeyboard = {
  reply_markup: {
    keyboard: [['❌ إلغاء']],
    resize_keyboard: true
  }
};

export const depositReviewKeyboard = (depositId) => ({
  reply_markup: {
    inline_keyboard: [
      [
        { text: '✅ قبول', callback_data: `deposit_accept_${depositId}` },
        { text: '❌ رفض', callback_data: `deposit_reject_${depositId}` }
      ]
    ]
  }
});

export const depositMethodKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🆔 Binance Pay ID', callback_data: 'deposit_binance_id' }],
      [{ text: '💼 عنوان المحفظة', callback_data: 'deposit_wallet' }],
      [{ text: '❌ إلغاء', callback_data: 'cancel' }]
    ]
  }
};

export const adminPanelKeyboard = {
  reply_markup: {
    keyboard: [
      ['✅ مراجعة المهام', '💵 مراجعة الإيداعات'],
      ['💸 مراجعة السحوبات', '🔍 البحث عن مستخدم'],
      ['✏️ تعديل نص الدعم', '🔧 تغيير الحد الأقصى للأشخاص'],
      ['📝 تغيير حد المهام للمستخدم', '⏱️ تغيير وقت المهلة'],
      ['🔄 تغيير مهلة التحسين', '💰 تغيير الحد الأدنى للمكافأة'],
      ['🔙 رجوع']
    ],
    resize_keyboard: true
  }
};

export const languageKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🇸🇦 العربية', callback_data: 'support_lang_ar' }],
      [{ text: '🇬🇧 English', callback_data: 'support_lang_en' }],
      [{ text: '🇷🇺 Русский', callback_data: 'support_lang_ru' }],
      [{ text: '❌ إلغاء', callback_data: 'cancel' }]
    ]
  }
};

export const userLanguageKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🇸🇦 العربية', callback_data: 'set_lang_ar' }],
      [{ text: '🇬🇧 English', callback_data: 'set_lang_en' }],
      [{ text: '🇷🇺 Русский', callback_data: 'set_lang_ru' }]
    ]
  }
};


export function getMainMenuKeyboard(isAdmin, lang = 'ar') {
  const texts = {
    ar: {
      tasks: '📋 المهام المتاحة',
      add: '➕ إضافة مهمة',
      info: 'ℹ️ معلوماتي',
      myTasks: '📊 مهامي',
      mySubmissions: '📝 إثباتاتي',
      submissions: '📝 التقديمات',
      deposit: '💳 إيداع USDT',
      withdraw: '💸 سحب USDT',
      review: '✅ مراجعة المهام',
      help: '⚙️ المساعدة',
      support: '💬 الدعم',
      language: '🌐 اللغة',
      adminPanel: '⚙️ لوحة التحكم'
    },
    en: {
      tasks: '📋 Available Tasks',
      add: '➕ Add Task',
      info: 'ℹ️ My Info',
      myTasks: '📊 My Tasks',
      mySubmissions: '📝 My Submissions',
      submissions: '📝 Submissions',
      deposit: '💳 Deposit USDT',
      withdraw: '💸 Withdraw USDT',
      review: '✅ Review Tasks',
      help: '⚙️ Help',
      support: '💬 Support',
      language: '🌐 Language',
      adminPanel: '⚙️ Admin Panel'
    },
    ru: {
      tasks: '📋 Доступные задачи',
      add: '➕ Добавить задачу',
      info: 'ℹ️ Моя информация',
      myTasks: '📊 Мои задачи',
      mySubmissions: '📝 Мои заявки',
      submissions: '📝 Заявки',
      deposit: '💳 Пополнить USDT',
      withdraw: '💸 Вывод USDT',
      review: '✅ Проверить задачи',
      help: '⚙️ Помощь',
      support: '💬 Поддержка',
      language: '🌐 Язык',
      adminPanel: '⚙️ Панель управления'
    }
  };

  const t = texts[lang] || texts.ar;

  if (isAdmin) {
    return {
      reply_markup: {
        keyboard: [
          [t.tasks, t.add],
          [t.info, t.myTasks],
          [t.mySubmissions, t.deposit],
          [t.withdraw, t.support],
          [t.language, t.adminPanel]
        ],
        resize_keyboard: true
      }
    };
  } else {
    return {
      reply_markup: {
        keyboard: [
          [t.tasks, t.add],
          [t.info, t.myTasks],
          [t.mySubmissions, t.deposit],
          [t.withdraw, t.support],
          [t.language]
        ],
        resize_keyboard: true
      }
    };
  }
}


// لوحة مفاتيح خيارات الرفض
export const getRejectKeyboard = (submissionId) => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: '🔄 رفض مع فرصة ثانية', callback_data: `reject_retry_${submissionId}` }],
      [{ text: '❌ رفض نهائي', callback_data: `reject_final_${submissionId}` }],
      [{ text: '🔙 رجوع', callback_data: `back_to_review_${submissionId}` }]
    ]
  }
});

// لوحة مفاتيح الإبلاغ
export const getReportKeyboard = (submissionId, reportedUserId) => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: '🚨 الإبلاغ عن صاحب المهمة', callback_data: `report_user_${submissionId}_${reportedUserId}` }]
    ]
  }
});
