// Logging and analytics for LinkedIn scraper
const winston = require('winston');
const path = require('path');

// Create logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, 'logs', 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, 'logs', 'scraper.log')
    })
  ]
});

// Add console output in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Scraping metrics
class ScrapingMetrics {
  constructor() {
    this.sessionStart = new Date();
    this.profilesScraped = 0;
    this.profilesFailed = 0;
    this.captchasEncountered = 0;
    this.warningsDetected = 0;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.rateLimitHits = 0;
    this.lastBreakTime = null;
    this.proxyRotations = 0;
  }

  logProfileSuccess(profile, timeSpent) {
    this.profilesScraped++;
    this.successfulRequests++;
    this.totalRequests++;
    
    logger.info('Profile scraped successfully', {
      profileId: profile.id,
      timeSpent,
      metrics: this.getMetrics()
    });
  }

  logProfileError(error, profileUrl) {
    this.profilesFailed++;
    this.totalRequests++;
    
    logger.error('Profile scraping failed', {
      profileUrl,
      error: error.message,
      metrics: this.getMetrics()
    });
  }

  logCaptcha() {
    this.captchasEncountered++;
    logger.warn('CAPTCHA detected', {
      metrics: this.getMetrics()
    });
  }

  logWarning(type, details) {
    this.warningsDetected++;
    logger.warn('LinkedIn warning detected', {
      type,
      details,
      metrics: this.getMetrics()
    });
  }

  logRateLimit() {
    this.rateLimitHits++;
    logger.warn('Rate limit hit', {
      metrics: this.getMetrics()
    });
  }

  logBreak(duration) {
    this.lastBreakTime = new Date();
    logger.info('Taking break', {
      duration,
      metrics: this.getMetrics()
    });
  }

  logProxyRotation(oldProxy, newProxy) {
    this.proxyRotations++;
    logger.info('Rotating proxy', {
      from: oldProxy,
      to: newProxy,
      metrics: this.getMetrics()
    });
  }

  getMetrics() {
    const duration = (new Date() - this.sessionStart) / 1000;
    const successRate = (this.successfulRequests / this.totalRequests) * 100 || 0;
    
    return {
      duration,
      profilesScraped: this.profilesScraped,
      profilesFailed: this.profilesFailed,
      successRate,
      captchasEncountered: this.captchasEncountered,
      warningsDetected: this.warningsDetected,
      rateLimitHits: this.rateLimitHits,
      proxyRotations: this.proxyRotations,
      profilesPerHour: (this.profilesScraped / duration) * 3600
    };
  }
}

module.exports = {
  logger,
  ScrapingMetrics
};