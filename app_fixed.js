import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { setTimeout } from 'timers/promises';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import googleSheetsService from './services/googleSheets.js';

// Load environment variables
dotenv.config();

// Enable stealth plugin
puppeteer.use(StealthPlugin());

const PUPPETEER_OPTIONS = {
  headless: false,
  defaultViewport: null,
  args: [
    '--start-maximized',
    '--disable-notifications',
    '--disable-extensions',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--disable-blink-features=AutomationControlled',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-component-extensions-with-background-pages',
    '--disable-ipc-flooding-protection',
    '--enable-features=NetworkService',
    '--disable-quic'
  ],
  ignoreDefaultArgs: ['--enable-automation'],
  protocolTimeout: 180000,
};

class N8nIntegration {
  constructor() {
    this.baseUrl = process.env.N8N_BASE_URL || 'http://localhost:3000/api/n8n';
  }

  async sendToWorkflow(data) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`Failed to send data to n8n: ${response.statusText}`);
    return response.json();
  }

  async notifyMessageSent(profileData, messageData) {
    return this.sendToWorkflow({
      event: 'message_sent',
      profile: profileData,
      message: messageData,
      timestamp: new Date().toISOString()
    });
  }

  async triggerPhoneContact(profileData) {
    return this.sendToWorkflow({
      event: 'phone_contact',
      profile: profileData,
      timestamp: new Date().toISOString()
    });
  }
}

class LinkedInMessenger {
  constructor() {
    this.browser = null;
    this.page = null;
    this.n8n = new N8nIntegration();
    this.credentials = {
      username: process.env.LINKEDIN_EMAIL,
      password: process.env.LINKEDIN_PASSWORD
    };
    this.message = 'Hi there! How are you doing? Hope everything is going well on your end!';
    this.maxMessagesPerDay = parseInt(process.env.MAX_MESSAGES_PER_DAY) || 25;
    this.minDelay = parseInt(process.env.MIN_DELAY_BETWEEN_MESSAGES) || 45;
    this.maxDelay = parseInt(process.env.MAX_DELAY_BETWEEN_MESSAGES) || 180;
  }

  async init() {
    this.browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    this.page = await this.browser.newPage();
    this.page.setDefaultNavigationTimeout(180000);
    this.page.setDefaultTimeout(60000);
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en'] });
      const origPerm = navigator.permissions.query;
      navigator.permissions.query = params => 
        params.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : origPerm(params);
    });
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await this.page.setViewport({ width: 1366, height: 768 });
    return true;
  }

  async humanDelay(min = 3000, max = 6000) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    console.log(`⏳ Waiting ${Math.round(delay/1000)}s...`);
    await setTimeout(delay);
  }

  async typeHumanLike(selector, text) {
    const element = await this.page.$(selector);
    if (!element) throw new Error(`Element ${selector} not found`);
    await element.focus();
    await setTimeout(500);
    for (const char of text) {
      await element.type(char, { delay: Math.random() * 150 + 50 });
    }
  }

  async login() {
    await this.page.goto('https://www.linkedin.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 180000
    });
    await this.humanDelay(2000, 4000);

    const acceptCookies = await this.page.$(
      'button[data-tracking-control-name="guest_homepage-basic_accept-cookies"]'
    );
    if (acceptCookies) {
      await acceptCookies.click();
      await setTimeout(1000);
    }

    await this.page.waitForSelector('#username', { visible: true, timeout: 60000 });
    await this.page.evaluate(() => {
      document.querySelector('#username').value = '';
      document.querySelector('#password').value = '';
    });
    await this.typeHumanLike('#username', this.credentials.username);
    await this.humanDelay(1000, 2000);
    await this.typeHumanLike('#password', this.credentials.password);
    await this.humanDelay(1000, 2000);
    await this.page.click('button[type="submit"]');

    try {
      await this.page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: 180000
      });
    } catch {}

    const loginSuccess = await this.page.evaluate(() => {
      return !location.href.includes('/login') &&
             !location.href.includes('/challenge') &&
             (document.querySelector('.feed-identity-module') !== null ||
              document.querySelector('.global-nav__me') !== null);
    });
    if (!loginSuccess) throw new Error('Login verification failed');
    console.log('✅ Successfully logged in!');
    return true;
  }

  async closeAllMessageWindows() {
    await this.page.evaluate(() => {
      const selectors = [
        '.msg-overlay-bubble-header__control--close-btn',
        '.artdeco-button--circle[aria-label*="Close"]',
        '[data-control-name="overlay.close_conversation_window"]'
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (el.offsetParent !== null) el.click();
        });
      });
    });
    await setTimeout(1000);
  }

  async automatedMessageFlow(profileUrl) {
    console.log('\n=====================================');
    console.log(`📝 MESSAGING FLOW START: ${new Date().toISOString()}`);
    console.log('=====================================');
    console.log('🎯 Target Profile:', profileUrl);
    console.log('📨 Message to send:', this.message);
    
    // Log browser state
    const pages = await this.browser.pages();
    console.log('🌐 Browser State:');
    console.log(`- Total Pages Open: ${pages.length}`);
    console.log(`- Current URL: ${await this.page.url()}`);
    console.log('-------------------------------------');

    // STEP 1: Clean-up
    await this.closeAllMessageWindows();

    // Hard reset context
    console.log('🌐 Resetting page context...');
    await this.page.goto('about:blank', { waitUntil: 'networkidle0' });
    await this.humanDelay(1000, 2000);

    // STEP 2: Navigate
    console.log('🌐 Navigating to profile...');
    console.log(`⏰ Navigation Start: ${new Date().toISOString()}`);
    const navResp = await this.page.goto(profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 180000
    });
    console.log('📍 Navigation Result:');
    console.log(`- Status: ${navResp?.status()}`);
    console.log(`- URL: ${await this.page.url()}`);
    console.log(`⏰ Navigation Complete: ${new Date().toISOString()}`);
    if (!navResp || navResp.status() >= 400) {
      throw new Error(`Navigation to ${profileUrl} failed: ${navResp?.status()}`);
    }
    await this.humanDelay(4000, 6000);

    // STEP 3: Wait for profile UI
    await this.page.waitForSelector('.pv-top-card, .ph5', {
      visible: true,
      timeout: 60000
    });

    // STEP 4: Click message button
    console.log('🔍 Looking for message button...');
    const clicked = await this.page.evaluate(() => {
      const cta = document.querySelector('.pv-top-card-v2-ctas, .ph5');
      if (!cta) {
        console.log('❌ CTA section not found');
        return { clicked: false, debug: 'CTA section not found' };
      }
      
      const btns = cta.querySelectorAll('button');
      console.log(`Found ${btns.length} buttons in CTA section`);
      
      for (const btn of btns) {
        const txt = btn.textContent?.toLowerCase() || '';
        const lbl = btn.getAttribute('aria-label')?.toLowerCase() || '';
        console.log('Button found:', { text: txt, label: lbl });
        
        if ((txt.includes('message') || lbl.includes('message')) &&
            !txt.includes('connect') &&
            !txt.includes('follow')) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          btn.click();
          return { clicked: true, debug: 'Message button clicked' };
        }
      }
      return { clicked: false, debug: 'No suitable message button found' };
    });
    
    console.log('🔘 Message Button Result:', clicked.debug);
    if (!clicked.clicked) throw new Error(`Could not find or click message button: ${clicked.debug}`);
    await this.humanDelay(2000, 4000);

    // STEP 5: Wait for overlay
    console.log('⏳ Waiting for message overlay...');
    try {
        await this.page.waitForSelector('.msg-overlay-conversation-bubble', {
            visible: true,
            timeout: 30000
        });
        console.log('✅ Message overlay appeared');
        
        // Get all overlays for debugging
        const overlays = await this.page.$$('.msg-overlay-conversation-bubble');
        console.log(`📊 Found ${overlays.length} message overlay(s)`);
    } catch (error) {
        console.error('❌ Failed to find message overlay:', error.message);
        throw error;
    }

    // STEP 6: Type into last message box
    console.log('📝 Preparing to type message...');
    const boxes = await this.page.$$('.msg-form__contenteditable');
    console.log(`📊 Found ${boxes.length} message input box(es)`);
    if (!boxes.length) throw new Error('Message box not found');
    
    const messageBox = boxes[boxes.length - 1];
    console.log('🎯 Selected last message box for input');
    
    console.log('⌨️ Clearing existing content...');
    await messageBox.focus();
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyA');
    await this.page.keyboard.up('Control');
    await this.page.keyboard.press('Delete');
    for (const char of this.message) {
      await this.page.keyboard.type(char, { delay: Math.random() * 80 + 40 });
    }
    await this.humanDelay(500, 1000);

    // STEP 7: Click last send button
    console.log('🔍 Looking for send button...');
    const sendButtons = await this.page.$$('button.msg-form__send-button:not(:disabled)');
    console.log(`📊 Found ${sendButtons.length} enabled send button(s)`);
    
    if (!sendButtons.length) throw new Error('Send button not available');
    console.log('🖱️ Clicking last send button');
    await sendButtons[sendButtons.length - 1].click();

    // STEP 8: Verify send
    console.log('✅ Verifying message sent...');
    await this.humanDelay(2000, 4000);
    const sendResult = await this.page.evaluate(() => {
      const btn = document.querySelector('button.msg-form__send-button');
      const status = {
        buttonFound: !!btn,
        buttonDisabled: btn?.disabled,
        buttonText: btn?.textContent?.trim(),
        conversationVisible: !!document.querySelector('.msg-overlay-conversation-bubble'),
        messageInputEmpty: document.querySelector('.msg-form__contenteditable')?.textContent?.trim() === ''
      };
      return status;
    });
    
    console.log('📊 Send Verification Status:', sendResult);
    const confirmed = sendResult.buttonFound && sendResult.buttonDisabled;
    if (!confirmed) throw new Error('Message send not confirmed');

    // STEP 9: Close overlay
    console.log('🚪 Closing message overlay...');
    const closeResult = await this.page.evaluate(() => {
      const selectors = [
        '.msg-overlay-bubble-header__control--close-btn',
        '.artdeco-button--circle[aria-label*="Close"]',
        '[data-control-name="overlay.close_conversation_window"]'
      ];
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          btn.click();
          console.log(`Clicked close button: ${sel}`);
          return { closed: true, selector: sel };
        }
      }
      return { closed: false, error: 'No close button found' };
    });
    
    console.log('🔒 Close overlay result:', closeResult);
    await this.humanDelay(1000, 2000);

    console.log('=====================================');
    console.log('✅ MESSAGING FLOW COMPLETE');
    console.log('=====================================');
    console.log('📊 Final Status:');
    console.log('- Profile URL:', profileUrl);
    console.log('- Message Sent:', confirmed);
    console.log('- Overlay Closed:', closeResult.closed);
    console.log('- Time:', new Date().toISOString());
    console.log('=====================================\n');
    
    return true;
  }

  async handlePhoneContact(profileData) {
    console.log('\n🔔 Triggering phone contact workflow');
    console.log('📞 Contact:', profileData);
    
    try {
      await this.n8n.triggerPhoneContact(profileData);
      await googleSheetsService.updateProfileStatus(profileData['profileUrl'], 'phone_contact_triggered');
      console.log('✅ Successfully triggered phone contact workflow');
      return true;
    } catch (error) {
      console.error('❌ Failed to trigger phone contact workflow:', error);
      await googleSheetsService.updateProfileStatus(profileData['Profile URL'], 'failed');
      return false;
    }
  }

  async runCampaign() {
    if (!await this.init()) throw new Error('Failed to initialize browser');
    if (!await this.login()) throw new Error('Failed to login');

    const profiles = await googleSheetsService.getProfileLinks();
    let successCount = 0, failureCount = 0;

    for (let i = 0; i < profiles.length; i++) {
      if (successCount >= this.maxMessagesPerDay) break;
      
      const profile = profiles[i];
      
      // Debug profile data
      console.log('Processing profile:', profile);
      console.log('Available fields:', Object.keys(profile));
      
      const hasPhoneNumber = profile['phone_number'] && profile['phone_number'].trim() !== '';
      console.log('Has phone number:', hasPhoneNumber, 'Value:', profile['phone_number']);
      
      console.log(`\n🎯 CAMPAIGN PROGRESS: ${i+1}/${profiles.length}`);
      
      let ok;
      if (hasPhoneNumber) {
        ok = await this.handlePhoneContact(profile);
      } else {
        ok = await this.automatedMessageFlow(profile['Profile URL']);
        if (ok) {
          await this.n8n.notifyMessageSent(profile, {
            status: 'completed',
            message: this.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      if (ok) {
        successCount++;
        await googleSheetsService.updateProfileStatus(profile['Profile URL'], 'completed');
      } else {
        failureCount++;
        await googleSheetsService.updateProfileStatus(profile['Profile URL'], 'failed');
      }

      if (i < profiles.length - 1 && successCount < this.maxMessagesPerDay) {
        console.log('⏳ Waiting before next profile...');
        await this.humanDelay(this.minDelay * 1000, this.maxDelay * 1000);
      }
    }

    console.log(`\n🎉 Campaign completed: ${successCount} succeeded, ${failureCount} failed.`);
    await this.browser.close();
  }
}

export { LinkedInMessenger };
export { default as googleSheetsService } from './services/googleSheets.js';
