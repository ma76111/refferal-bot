import axios from 'axios';
import crypto from 'crypto';
import { logInfo, logSuccess, logError, logWarning } from './logger.js';

class BinanceAPI {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseURL = 'https://api.binance.com';
  }

  // إنشاء التوقيع للطلبات
  createSignature(queryString) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  // طلب موقع
  async signedRequest(endpoint, params = {}) {
    try {
      const timestamp = Date.now();
      const queryString = new URLSearchParams({
        ...params,
        timestamp,
        recvWindow: 60000
      }).toString();

      const signature = this.createSignature(queryString);
      const url = `${this.baseURL}${endpoint}?${queryString}&signature=${signature}`;

      const response = await axios.get(url, {
        headers: {
          'X-MBX-APIKEY': this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      logError('BINANCE', `API Error: ${error.response?.data?.msg || error.message}`);
      throw error;
    }
  }

  // الحصول على سجل الإيداعات
  async getDepositHistory(coin = 'USDT', limit = 100) {
    try {
      logInfo('BINANCE', `Fetching deposit history for ${coin}`);
      
      const deposits = await this.signedRequest('/sapi/v1/capital/deposit/hisrec', {
        coin,
        limit,
        status: 1 // 1 = Success
      });

      logSuccess('BINANCE', `Found ${deposits.length} deposits`);
      return deposits;
    } catch (error) {
      logError('BINANCE', 'Failed to fetch deposit history');
      return [];
    }
  }

  // الحصول على عنوان الإيداع
  async getDepositAddress(coin = 'USDT', network = 'TRX') {
    try {
      logInfo('BINANCE', `Getting deposit address for ${coin} on ${network}`);
      
      const address = await this.signedRequest('/sapi/v1/capital/deposit/address', {
        coin,
        network
      });

      logSuccess('BINANCE', `Deposit address: ${address.address}`);
      return address;
    } catch (error) {
      logError('BINANCE', 'Failed to get deposit address');
      return null;
    }
  }

  // التحقق من إيداع معين باستخدام txId
  async verifyDeposit(txId, coin = 'USDT') {
    try {
      logInfo('BINANCE', `Verifying deposit with txId: ${txId}`);
      
      const deposits = await this.getDepositHistory(coin, 1000);
      const deposit = deposits.find(d => d.txId === txId);

      if (deposit) {
        logSuccess('BINANCE', `Deposit verified: ${deposit.amount} ${coin}`);
        return {
          verified: true,
          amount: parseFloat(deposit.amount),
          coin: deposit.coin,
          status: deposit.status,
          address: deposit.address,
          addressTag: deposit.addressTag,
          txId: deposit.txId,
          insertTime: deposit.insertTime
        };
      } else {
        logWarning('BINANCE', `Deposit not found: ${txId}`);
        return { verified: false };
      }
    } catch (error) {
      logError('BINANCE', 'Failed to verify deposit');
      return { verified: false, error: error.message };
    }
  }

  // التحقق من إيداع باستخدام Binance ID (addressTag/memo)
  async verifyDepositByTag(tag, coin = 'USDT', minAmount = 0.1) {
    try {
      logInfo('BINANCE', `Verifying deposit with tag: ${tag}`);
      
      const deposits = await this.getDepositHistory(coin, 1000);
      const deposit = deposits.find(d => 
        d.addressTag === tag && 
        parseFloat(d.amount) >= minAmount &&
        d.status === 1 // Success
      );

      if (deposit) {
        logSuccess('BINANCE', `Deposit verified: ${deposit.amount} ${coin}`);
        return {
          verified: true,
          amount: parseFloat(deposit.amount),
          coin: deposit.coin,
          txId: deposit.txId,
          insertTime: deposit.insertTime
        };
      } else {
        logWarning('BINANCE', `No deposit found with tag: ${tag}`);
        return { verified: false };
      }
    } catch (error) {
      logError('BINANCE', 'Failed to verify deposit by tag');
      return { verified: false, error: error.message };
    }
  }

  // اختبار الاتصال
  async testConnection() {
    try {
      logInfo('BINANCE', 'Testing API connection...');
      
      const account = await this.signedRequest('/api/v3/account');
      
      logSuccess('BINANCE', 'API connection successful!');
      return { success: true, canTrade: account.canTrade };
    } catch (error) {
      logError('BINANCE', 'API connection failed');
      return { success: false, error: error.message };
    }
  }

  // إنشاء طلب دفع عبر Binance Pay
  async createPaymentOrder(merchantTradeNo, totalAmount, currency = 'USDT', description = 'Deposit') {
    try {
      logInfo('BINANCE_PAY', `Creating payment order: ${totalAmount} ${currency}`);
      
      const timestamp = Date.now();
      const nonce = crypto.randomBytes(16).toString('hex');
      
      const body = {
        env: {
          terminalType: 'WEB'
        },
        merchantTradeNo,
        orderAmount: parseFloat(totalAmount),
        currency,
        goods: {
          goodsType: '02',
          goodsCategory: 'Z000',
          referenceGoodsId: 'deposit',
          goodsName: description
        }
      };

      const payload = timestamp + '\n' + nonce + '\n' + JSON.stringify(body) + '\n';
      const signature = crypto
        .createHmac('sha512', this.apiSecret)
        .update(payload)
        .digest('hex')
        .toUpperCase();

      const response = await axios.post(
        `${this.baseURL}/binancepay/openapi/v2/order`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'BinancePay-Timestamp': timestamp,
            'BinancePay-Nonce': nonce,
            'BinancePay-Certificate-SN': this.apiKey,
            'BinancePay-Signature': signature
          }
        }
      );

      if (response.data.status === 'SUCCESS') {
        logSuccess('BINANCE_PAY', `Payment order created: ${response.data.data.prepayId}`);
        return {
          success: true,
          prepayId: response.data.data.prepayId,
          qrcodeLink: response.data.data.qrcodeLink,
          qrContent: response.data.data.qrContent,
          checkoutUrl: response.data.data.checkoutUrl,
          deeplink: response.data.data.deeplink,
          universalUrl: response.data.data.universalUrl
        };
      } else {
        logError('BINANCE_PAY', `Failed to create order: ${response.data.message}`);
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      logError('BINANCE_PAY', `Error creating payment order: ${error.response?.data?.message || error.message}`);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // التحقق من حالة الدفع
  async queryPaymentOrder(prepayId) {
    try {
      logInfo('BINANCE_PAY', `Querying payment order: ${prepayId}`);
      
      const timestamp = Date.now();
      const nonce = crypto.randomBytes(16).toString('hex');
      const body = { prepayId };

      const payload = timestamp + '\n' + nonce + '\n' + JSON.stringify(body) + '\n';
      const signature = crypto
        .createHmac('sha512', this.apiSecret)
        .update(payload)
        .digest('hex')
        .toUpperCase();

      const response = await axios.post(
        `${this.baseURL}/binancepay/openapi/v2/order/query`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'BinancePay-Timestamp': timestamp,
            'BinancePay-Nonce': nonce,
            'BinancePay-Certificate-SN': this.apiKey,
            'BinancePay-Signature': signature
          }
        }
      );

      if (response.data.status === 'SUCCESS') {
        const orderData = response.data.data;
        logSuccess('BINANCE_PAY', `Order status: ${orderData.status}`);
        return {
          success: true,
          status: orderData.status,
          orderAmount: orderData.orderAmount,
          transactionId: orderData.transactionId,
          transactTime: orderData.transactTime
        };
      } else {
        logError('BINANCE_PAY', `Failed to query order: ${response.data.message}`);
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      logError('BINANCE_PAY', `Error querying payment order: ${error.response?.data?.message || error.message}`);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }
}

export default BinanceAPI;
