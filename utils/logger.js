// نظام تتبع شامل للبوت

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

function getTimestamp() {
  return new Date().toLocaleString('en-US', { 
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function logInfo(category, message, data = null) {
  console.log(
    `${colors.blue}[INFO]${colors.reset} ${colors.dim}${getTimestamp()}${colors.reset} ` +
    `${colors.cyan}[${category}]${colors.reset} ${message}`
  );
  if (data) {
    console.log(`${colors.dim}Data:${colors.reset}`, data);
  }
}

export function logSuccess(category, message, data = null) {
  console.log(
    `${colors.green}[SUCCESS]${colors.reset} ${colors.dim}${getTimestamp()}${colors.reset} ` +
    `${colors.cyan}[${category}]${colors.reset} ${message}`
  );
  if (data) {
    console.log(`${colors.dim}Data:${colors.reset}`, data);
  }
}

export function logWarning(category, message, data = null) {
  console.log(
    `${colors.yellow}[WARNING]${colors.reset} ${colors.dim}${getTimestamp()}${colors.reset} ` +
    `${colors.cyan}[${category}]${colors.reset} ${message}`
  );
  if (data) {
    console.log(`${colors.dim}Data:${colors.reset}`, data);
  }
}

export function logError(category, message, error = null) {
  console.log(
    `${colors.red}[ERROR]${colors.reset} ${colors.dim}${getTimestamp()}${colors.reset} ` +
    `${colors.cyan}[${category}]${colors.reset} ${message}`
  );
  if (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error);
  }
}

export function logUser(action, userId, username, data = null) {
  console.log(
    `${colors.magenta}[USER]${colors.reset} ${colors.dim}${getTimestamp()}${colors.reset} ` +
    `${colors.cyan}[${action}]${colors.reset} User: ${userId} (@${username || 'unknown'})`
  );
  if (data) {
    console.log(`${colors.dim}Data:${colors.reset}`, data);
  }
}

export function logCommand(command, userId, username) {
  console.log(
    `${colors.bright}${colors.blue}[COMMAND]${colors.reset} ${colors.dim}${getTimestamp()}${colors.reset} ` +
    `${colors.yellow}${command}${colors.reset} from ${userId} (@${username || 'unknown'})`
  );
}

export function logCallback(callbackData, userId, username) {
  console.log(
    `${colors.bright}${colors.magenta}[CALLBACK]${colors.reset} ${colors.dim}${getTimestamp()}${colors.reset} ` +
    `${colors.yellow}${callbackData}${colors.reset} from ${userId} (@${username || 'unknown'})`
  );
}

export function logDatabase(operation, table, data = null) {
  console.log(
    `${colors.cyan}[DATABASE]${colors.reset} ${colors.dim}${getTimestamp()}${colors.reset} ` +
    `${colors.green}${operation}${colors.reset} on ${colors.yellow}${table}${colors.reset}`
  );
  if (data) {
    console.log(`${colors.dim}Data:${colors.reset}`, data);
  }
}

export function logSeparator() {
  console.log(`${colors.dim}${'='.repeat(80)}${colors.reset}`);
}

// Default export object for easier importing
export default {
  info: (message, data = null) => logInfo('INFO', message, data),
  success: (message, data = null) => logSuccess('SUCCESS', message, data),
  warning: (message, data = null) => logWarning('WARNING', message, data),
  error: (message, error = null) => logError('ERROR', message, error),
  user: (message, data = null) => logInfo('USER', message, data),
  command: (message, data = null) => logInfo('COMMAND', message, data),
  callback: (message, data = null) => logInfo('CALLBACK', message, data),
  database: (message, data = null) => logInfo('DATABASE', message, data),
  separator: logSeparator
};
