import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import { setTimeout } from 'timers/promises';

// Configure puppeteer options
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
        '--disable-features=IsolateOrigins,site-per-process'
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    protocolTimeout: 60000,
};

// LinkedIn profile URLs to message
const users = [
    'https://www.linkedin.com/in/sandhanaraj-navin-613822225/',
    'https://www.linkedin.com/in/parvathavardhini-k/',
    'https://www.linkedin.com/in/navin-nk-044a4323b/',
    'https://www.linkedin.com/in/vignesh-kumar-8101581b0/',
    'https://www.linkedin.com/in/aishwarya-gunasekaran-882209243/',
    'https://www.linkedin.com/in/surya04/',
    'https://www.linkedin.com/in/barath-vc/',
    'https://www.linkedin.com/in/sindhiya-selvaraj-61b07a39/',
    'https://www.linkedin.com/in/dinesh-kumar-v-92461b22a/',
    'https://www.linkedin.com/in/sivasubramani-k-n-469b56244/',
    'https://www.linkedin.com/in/prathap0803/',
    'https://www.linkedin.com/in/lakshmi-narayanan-n-d-b8454b35/',
    'https://www.linkedin.com/in/vigneswari-kannan-74bba21a0/',
    'https://www.linkedin.com/in/sowmiya05/'
];

class LinkedInMessenger {
    constructor() {
        this.browser = null;
        this.page = null;
        this.credentials = {
            username: 'akashcse018@gmail.com',
            password: 'Akash12041977'
        };
        this.message = 'Hi there! Hope this finds you. \n Note this is a Test message turn towards me and Show thumbs Up if you got the message😅.';
    }

    async init() {
        try {
            // Launch browser with specific configurations
            this.browser = await puppeteer.launch(PUPPETEER_OPTIONS);

            // Create new page and set default navigation timeout
            this.page = await this.browser.newPage();
            this.page.setDefaultNavigationTimeout(30000);

            // Enable console logging from the page
            this.page.on('console', msg => console.log('Browser Log:', msg.text()));

            return true;
        } catch (error) {
            console.error('Failed to initialize:', error);
            return false;
        }
    }

    async humanDelay(min = 3000, max = 7000) {
        const delay = Math.floor(Math.random() * (max - min + 1) + min);
        await setTimeout(delay);
    }

    async typeHumanLike(element, text) {
        for (const char of text) {
            await element.type(char, { delay: Math.random() * 200 + 100 });
            if (char === ' ') {
                await setTimeout(Math.random() * 300 + 200);
            }
        }
    }

    async login() {
        try {
            console.log('Navigating to LinkedIn login page...');
            await this.page.goto('https://www.linkedin.com/login', { 
                waitUntil: 'networkidle2',
                timeout: 60000 
            });

            console.log('Waiting for login form...');
            await this.page.waitForSelector('#username', { visible: true, timeout: 60000 });

            console.log('Entering credentials...');
            // Clear fields first
            await this.page.evaluate(() => document.querySelector('#username').value = '');
            await this.page.evaluate(() => document.querySelector('#password').value = '');
            
            // Type credentials with human-like delays
            await this.typeHumanLike(await this.page.$('#username'), this.credentials.username);
            await this.humanDelay(1000, 2000);
            await this.typeHumanLike(await this.page.$('#password'), this.credentials.password);
            await this.humanDelay(1000, 2000);

            console.log('Clicking sign in...');
            await this.page.click('button[type="submit"]');
            
            // Wait for navigation and home page to load
            try {
                await this.page.waitForNavigation({ 
                    waitUntil: 'networkidle2',
                    timeout: 60000 
                });
                
                // Additional check to ensure we're logged in
                await this.page.waitForSelector('.feed-identity-module', { 
                    timeout: 60000,
                    visible: true 
                });
                
                console.log('Successfully logged in!');
                await this.humanDelay(3000, 5000);
                return true;
            } catch (navError) {
                console.log('Navigation after login taking longer than expected, checking if logged in...');
                // Check if we're logged in despite navigation timeout
                const isLoggedIn = await this.page.evaluate(() => {
                    return document.querySelector('.feed-identity-module') !== null;
                });
                if (isLoggedIn) {
                    console.log('Successfully logged in (verified by DOM check)');
                    return true;
                }
                throw navError;
            }
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    }

    async sendMessage(profileUrl) {
        try {
            console.log(`\nNavigating to profile: ${profileUrl}`);
            await this.page.goto(profileUrl, { 
                waitUntil: 'networkidle2',
                timeout: 60000 
            });
            await this.humanDelay(3000, 5000);

            // Wait for the profile page to load completely
            console.log('Waiting for profile page to load...');
            await this.page.waitForSelector('.pv-top-card', { 
                visible: true, 
                timeout: 60000 
            });

            // Look for the message button using multiple selectors
            console.log('Looking for message button...');
            const messageButton = await this.page.evaluate(() => {
                // Try multiple possible button locations
                const selectors = [
                    'button[aria-label*="message" i]',
                    'button.artdeco-button[aria-label*="Message" i]',
                    '.pv-top-card-v2-ctas button:not([aria-label*="Connect"])',
                    '.pvs-profile-actions button:not([aria-label*="Connect"])'
                ];

                for (const selector of selectors) {
                    const buttons = Array.from(document.querySelectorAll(selector));
                    const messageBtn = buttons.find(btn => {
                        const text = (btn.textContent || '').toLowerCase();
                        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                        return text.includes('message') || ariaLabel.includes('message');
                    });
                    if (messageBtn) {
                        messageBtn.click();
                        return true;
                    }
                }
                return false;
            });

            if (!messageButton) {
                throw new Error('Message button not found or not clickable');
            }

            await this.humanDelay(2000, 3000);

            // Wait for message composer to appear
            const messageBox = await this.page.waitForSelector('div[role="textbox"]');
            if (!messageBox) {
                throw new Error('Message textbox not found');
            }

            // Type message with human-like delays
            console.log('Typing message...');
            await this.typeHumanLike(messageBox, this.message);
            await this.humanDelay(1000, 2000);

            // Click send button
            const sendButton = await this.page.waitForSelector('button.msg-form__send-button:not(:disabled)');
            await sendButton.click();
            console.log('Message sent successfully!');

            // Wait for message to be sent and close the chat window
            await this.humanDelay(2000, 3000);
            
            // Try to close the message overlay
            try {
                await this.page.click('.msg-overlay-bubble-header__control--close-btn');
            } catch (error) {
                console.log('Note: Could not close message overlay');
            }

            await this.humanDelay(30000, 45000); // Wait 30-45 seconds before next message
            return true;
        } catch (error) {
            console.error(`Failed to send message: ${error.message}`);
            return false;
        }
    }

    async processProfiles() {
        try {
            if (!await this.init()) {
                throw new Error('Failed to initialize browser');
            }

            if (!await this.login()) {
                throw new Error('Failed to login');
            }

            console.log(`\nStarting to process ${users.length} profiles...`);
            
            for (let i = 0; i < users.length; i++) {
                console.log(`\nProcessing profile ${i + 1}/${users.length}`);
                await this.sendMessage(users[i]);
            }

        } catch (error) {
            console.error('Error in processing profiles:', error);
        } finally {
            // Close the browser
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// Run the automation
const messenger = new LinkedInMessenger();
messenger.processProfiles().catch(console.error);