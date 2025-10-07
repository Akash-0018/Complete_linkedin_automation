// Browser and proxy management for enhanced stealth
const fs = require('fs');
const path = require('path');
const ProxyChain = require('proxy-chain');
const config = require('./config');
const { logger } = require('./logger');
const { randomUserAgent, randomViewport } = require('./utils');

class StealthManager {
  constructor() {
    this.currentProxy = null;
    this.currentProfile = null;
    this.profilesCount = 0;
    this.proxyServer = null;
  }

  async initializeBrowserProfile() {
    const profileDir = path.join(
      config.BROWSER_PROFILES_DIR,
      `profile-${Date.now()}`
    );
    
    if (!fs.existsSync(config.BROWSER_PROFILES_DIR)) {
      fs.mkdirSync(config.BROWSER_PROFILES_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    
    this.currentProfile = profileDir;
    return profileDir;
  }

  async setupProxy() {
    if (!config.USE_PROXIES || config.PROXY_LIST.length === 0) {
      return null;
    }

    const proxy = config.PROXY_LIST[
      Math.floor(Math.random() * config.PROXY_LIST.length)
    ];

    try {
      // Create authenticated proxy URL if credentials are provided
      const proxyUrl = config.PROXY_USERNAME && config.PROXY_PASSWORD
        ? `http://${config.PROXY_USERNAME}:${config.PROXY_PASSWORD}@${proxy}`
        : `http://${proxy}`;

      // Create new proxy server
      const oldProxyUrl = this.currentProxy;
      this.currentProxy = await ProxyChain.anonymizeProxy(proxyUrl);
      
      // Log proxy rotation
      if (oldProxyUrl) {
        logger.info('Rotating proxy', {
          from: oldProxyUrl,
          to: this.currentProxy
        });
      }

      return this.currentProxy;
    } catch (error) {
      logger.error('Failed to setup proxy', { error });
      return null;
    }
  }

  async getStealthConfiguration() {
    // Rotate browser profile if needed
    if (this.profilesCount >= config.ROTATE_PROFILE_AFTER || !this.currentProfile) {
      this.currentProfile = await this.initializeBrowserProfile();
      this.profilesCount = 0;
    }

    // Rotate proxy if needed
    if (this.profilesCount % config.ROTATE_PROXY_AFTER === 0) {
      await this.setupProxy();
    }

    this.profilesCount++;

    // Return configuration for puppeteer
    return {
      userDataDir: this.currentProfile,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        `--user-agent=${randomUserAgent(config.USER_AGENT_LIST)}`,
        ...(this.currentProxy ? [`--proxy-server=${this.currentProxy}`] : [])
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: randomViewport(config.VIEWPORTS)
    };
  }

  async simulateHumanBehavior(page) {
    // Random typing speed
    const typeText = async (selector, text) => {
      await page.focus(selector);
      for (const char of text) {
        await page.keyboard.type(char, {
          delay: Math.random() * 
            (config.TYPING_SPEED.MAX - config.TYPING_SPEED.MIN) + 
            config.TYPING_SPEED.MIN
        });
      }
    };

    // Random mouse movement
    const moveMouseRandomly = async () => {
      const { width, height } = page.viewport();
      const points = Array(3).fill().map(() => ({
        x: Math.floor(Math.random() * width),
        y: Math.floor(Math.random() * height)
      }));

      for (const point of points) {
        await page.mouse.move(point.x, point.y, {
          steps: Math.floor(Math.random() * 20) + 10
        });
        await new Promise(r => setTimeout(r, Math.random() * 1000));
      }
    };

    return {
      typeText,
      moveMouseRandomly
    };
  }

  async cleanup() {
    if (this.proxyServer) {
      await ProxyChain.closeAnonymizedProxy(this.currentProxy, true);
    }
    // Clean up old browser profiles
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();
    
    const profiles = fs.readdirSync(config.BROWSER_PROFILES_DIR);
    for (const profile of profiles) {
      const profilePath = path.join(config.BROWSER_PROFILES_DIR, profile);
      const stats = fs.statSync(profilePath);
      if (now - stats.ctime.getTime() > maxAge) {
        fs.rmSync(profilePath, { recursive: true, force: true });
        logger.info(`Cleaned up old browser profile: ${profile}`);
      }
    }
  }
}

module.exports = StealthManager;