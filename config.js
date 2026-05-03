import dotenv from 'dotenv';
dotenv.config();

export default {
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_IDS: process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [],
  MAX_IMAGES: 3,
  DATABASE_PATH: './bot.db',
  MAX_REQUIRED_COUNT: 10, // الحد الأقصى الافتراضي
  
  // Binance API Configuration
  BINANCE_API_KEY: process.env.BINANCE_API_KEY,
  BINANCE_API_SECRET: process.env.BINANCE_API_SECRET,
  BINANCE_DEPOSIT_ADDRESS: process.env.BINANCE_DEPOSIT_ADDRESS,
  BINANCE_NETWORK: process.env.BINANCE_NETWORK || 'BSC',
  MIN_DEPOSIT_AMOUNT: parseFloat(process.env.MIN_DEPOSIT_AMOUNT) || 0.1
};

