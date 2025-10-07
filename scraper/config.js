// Enhanced configuration for LinkedIn scraper
require('dotenv').config();

module.exports = {
  // LinkedIn URLs and endpoints
  LINKEDIN_LOGIN_URL: 'https://www.linkedin.com/login',
  LINKEDIN_SEARCH_URL: 'https://www.linkedin.com/search/results/people/',
  
  // Rate limiting and session management
  MAX_PROFILES_PER_DAY: 40,
  SESSION_MINUTES: 120, // 2 hours
  SESSION_MAX_MINUTES: 180, // 3 hours
  BREAK_MINUTES_MIN: 30,
  BREAK_MINUTES_MAX: 45,
  
  // Activity scaling
  INITIAL_PROFILE_LIMIT: 10,
  PROFILE_INCREMENT_WEEKLY: 10,
  ACTIVITY_SCALING: true,
  
  // Browser profiles and rotation
  BROWSER_PROFILES_DIR: './browser-profiles',
  MAX_BROWSER_PROFILES: 5,
  ROTATE_PROFILE_AFTER: 20, // profiles
  
  // Proxy configuration
  USE_PROXIES: process.env.USE_PROXIES === 'true',
  PROXY_LIST: (process.env.PROXY_LIST || '').split(',').filter(Boolean),
  PROXY_USERNAME: process.env.PROXY_USERNAME,
  PROXY_PASSWORD: process.env.PROXY_PASSWORD,
  ROTATE_PROXY_AFTER: 15, // profiles
  
  // User agents and viewports
  USER_AGENT_LIST: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ],
  VIEWPORTS: [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1680, height: 1050 }
  ],
  
  // Human behavior simulation
  TYPING_SPEED: {
    MIN: 100, // ms per character
    MAX: 200
  },
  MOUSE_SPEED: {
    MIN: 800, // ms for movement
    MAX: 2000
  },
  SCROLL_BEHAVIOR: {
    SPEED_MIN: 100, // pixels per scroll
    SPEED_MAX: 300,
    PAUSE_MIN: 500, // ms between scrolls
    PAUSE_MAX: 1500
  },
  
  // Google Sheets configuration
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  GOOGLE_CREDENTIALS_PATH: process.env.GOOGLE_CREDENTIALS_PATH || './config/google-sheets-credentials.json',
  SHEETS_BATCH_SIZE: 100,
  
  // Error handling and health monitoring
  HEALTH_PAUSE_THRESHOLD: 3, // Number of errors before pausing
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5000,
  WARNING_TYPES: [
    'unusual_activity',
    'verification_needed',
    'captcha',
    'rate_limit',
    'account_restriction'
  ],
  
  // Search configuration
  SEARCH_RESULT_LIMIT: 1000, // Maximum results to collect per search
  RESULTS_PER_PAGE: 10,
  MAX_PAGES_PER_SEARCH: 100,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_DIR: './logs',
  BACKUP_DIR: './backups'
};
