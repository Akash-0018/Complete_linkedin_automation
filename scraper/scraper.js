// Enhanced LinkedIn profile scraper with advanced features
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const utils = require('./utils');
const StealthManager = require('./stealth');
const { validateProfile, ProfileDeduplicator } = require('./validation');
const { logger, ScrapingMetrics } = require('./logger');
const SheetsManager = require('./sheets');

puppeteer.use(StealthPlugin());

class LinkedInScraper {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.stealthManager = new StealthManager();
    this.metrics = new ScrapingMetrics();
    this.deduplicator = new ProfileDeduplicator();
    this.sheetsManager = null;
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    const credentials = require(config.GOOGLE_CREDENTIALS_PATH);
    this.sheetsManager = new SheetsManager(credentials, config.GOOGLE_SHEET_ID);
    await this.sheetsManager.initialize();
    await this.sheetsManager.ensureHeaders();
  }

  async login() {
    const browserConfig = await this.stealthManager.getStealthConfiguration();
    this.browser = await puppeteer.launch({
      headless: false,
      ...browserConfig
    });
    this.page = await this.browser.newPage();
    const { typeText, moveMouseRandomly } = await this.stealthManager.simulateHumanBehavior(this.page);

    await this.page.goto(config.LINKEDIN_LOGIN_URL, { waitUntil: 'networkidle2' });
    await utils.randomDelay();
    await typeText('#username', this.username);
    await typeText('#password', this.password);
    await moveMouseRandomly();
    await utils.randomDelay();
    await this.page.click('button[type=submit]');
    await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
  }

  async searchProfiles(keywords, filters = {}) {
    const searchUrl = new URL(config.LINKEDIN_SEARCH_URL);
    searchUrl.searchParams.set('keywords', keywords);
    Object.entries(filters).forEach(([key, value]) => {
      searchUrl.searchParams.set(key, value);
    });

    const profiles = [];
    let page = 1;

    while (profiles.length < config.SEARCH_RESULT_LIMIT && page <= config.MAX_PAGES_PER_SEARCH) {
      searchUrl.searchParams.set('page', page);
      await this.page.goto(searchUrl.toString(), { waitUntil: 'networkidle2' });
      await utils.humanScroll(this.page);
      
      const newProfiles = await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('.reusable-search__result-container'))
          .map(container => {
            const profileLink = container.querySelector('a.app-aware-link');
            return profileLink ? profileLink.href : null;
          })
          .filter(Boolean);
      });

      profiles.push(...newProfiles);
      if (newProfiles.length < config.RESULTS_PER_PAGE) break;
      
      page++;
      await utils.randomDelay();
    }

    return [...new Set(profiles)]; // Remove duplicates
  }

  async extractContactInfo(profileUrl) {
    // Navigate to contact info page
    const contactUrl = profileUrl.replace(/\/in\//, '/in/*/detail/contact-info/');
    await this.page.goto(contactUrl, { waitUntil: 'networkidle2' });
    
    return this.page.evaluate(() => {
      const getContactItems = () => {
        const items = {};
        document.querySelectorAll('.pv-contact-info__contact-type').forEach(section => {
          const type = section.querySelector('.pv-contact-info__header')?.innerText.toLowerCase();
          const value = section.querySelector('.pv-contact-info__ci-container')?.innerText;
          if (type && value) items[type] = value;
        });
        return items;
      };
      
      return getContactItems();
    });
  }

  async extractProfile(url) {
    await this.page.goto(url, { waitUntil: 'networkidle2' });
    await this.detectWarnings();
    await utils.humanScroll(this.page);
    await this.stealthManager.simulateHumanBehavior(this.page);

    const profile = await this.page.evaluate(() => {
      const getText = sel => document.querySelector(sel)?.innerText?.trim() || '';
      const getList = sel => Array.from(document.querySelectorAll(sel))
        .map(e => e.innerText.trim())
        .filter(Boolean);

      return {
        name: getText('.text-heading-xlarge'),
        title: getText('.text-body-medium.break-words'),
        location: getText('.text-body-small.inline.t-black--light.break-words'),
        experience: getList('#experience ~ .pvs-list .pvs-entity__path-node'),
        education: getList('#education ~ .pvs-list .pvs-entity__path-node'),
        skills: getList('.pvs-list__outer-container .pvs-entity__skill-category-entity'),
        about: getText('.display-flex.ph5.pv3 .text-body-medium.break-words')
      };
    });

    // Extract contact information
    const contactInfo = await this.extractContactInfo(url);
    profile.email = contactInfo.email || '';
    profile.phone = contactInfo.phone || '';
    
    return validateProfile(profile);
  }

  async detectWarnings() {
    const warnings = await this.page.evaluate(() => {
      const elements = {
        unusual_activity: document.querySelector("text=unusual activity"),
        verification_needed: document.querySelector("text=verify your identity"),
        captcha: document.querySelector("input#captcha"),
        rate_limit: document.querySelector("text=you've reached the limit"),
        account_restriction: document.querySelector("text=account restriction")
      };
      return Object.entries(elements)
        .filter(([_, element]) => element)
        .map(([type]) => type);
    });

    if (warnings.length > 0) {
      warnings.forEach(type => this.metrics.logWarning(type));
      if (warnings.includes('captcha')) {
        this.metrics.logCaptcha();
        throw new Error('CAPTCHA detected');
      }
      if (warnings.length >= 2) {
        throw new Error('Multiple warnings detected - stopping for safety');
      }
    }
  }

  async scrapeProfiles(profileUrls) {
    const startTime = Date.now();
    let scraped = 0;

    for (const url of profileUrls) {
      try {
        if (this.deduplicator.isDuplicate(url)) {
          logger.info(`Skipping duplicate profile: ${url}`);
          continue;
        }

        const profile = await this.extractProfile(url);
        const timeSpent = Date.now() - startTime;
        
        if (!this.deduplicator.isDuplicate(profile)) {
          await this.sheetsManager.appendProfile(profile);
          this.deduplicator.addProfile(profile);
          this.metrics.logProfileSuccess(profile, timeSpent);
          scraped++;
        }

        // Check for rotation/breaks
        if (scraped % config.ROTATE_PROXY_AFTER === 0) {
          await this.stealthManager.setupProxy();
        }
        
        if (scraped % config.INITIAL_PROFILE_LIMIT === 0) {
          const breakTime = utils.randomInt(
            config.BREAK_MINUTES_MIN * 60 * 1000,
            config.BREAK_MINUTES_MAX * 60 * 1000
          );
          this.metrics.logBreak(breakTime);
          await utils.sleep(breakTime);
        }

        if (scraped >= config.MAX_PROFILES_PER_DAY) {
          logger.info('Daily profile limit reached');
          break;
        }

        await utils.randomDelay();
      } catch (error) {
        this.metrics.logProfileError(error, url);
        if (this.metrics.profilesFailed >= config.HEALTH_PAUSE_THRESHOLD) {
          logger.error('Too many errors - stopping for safety');
          break;
        }
      }
    }

    // Ensure all pending writes are flushed
    await this.sheetsManager.flushWrites();
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
    await this.stealthManager.cleanup();
  }
}

module.exports = LinkedInScraper;
