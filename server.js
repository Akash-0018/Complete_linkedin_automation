import express from 'express';
import cors from 'cors';
import { LinkedInMessenger } from './app_fixed.js';
import googleSheetsService from './services/googleSheets.js';
import campaignsRouter from './routes/campaigns.js';

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/campaigns', campaignsRouter);

// Messenger session management
let isMessaging = false;

async function createNewMessengerSession() {
    console.log('Creating new messenger session...');
    const messenger = new LinkedInMessenger();
    try {
        await messenger.init();
        await messenger.login();
        return messenger;
    } catch (error) {
        console.error('Error creating messenger session:', error);
        await messenger.browser?.close();
        throw error;
    }
}

async function cleanupSession(messenger) {
    try {
        if (messenger && messenger.browser) {
            console.log('Cleaning up messenger session...');
            await messenger.browser.close();
        }
    } catch (error) {
        console.error('Error cleaning up messenger session:', error);
    } finally {
        isMessaging = false;
    }
}

// Get profiles from Google Sheets
app.get('/api/profiles', async (req, res) => {
    console.log('\n=== FETCHING PROFILES ===');
    try {
        console.log('🔄 Initializing Google Sheets service...');
        if (!process.env.GOOGLE_SHEETS_ID) {
            throw new Error('GOOGLE_SHEETS_ID not configured in environment variables');
        }
        if (!process.env.GOOGLE_SHEETS_CREDENTIALS_PATH) {
            throw new Error('GOOGLE_SHEETS_CREDENTIALS_PATH not configured in environment variables');
        }

        console.log('📊 Sheet ID:', process.env.GOOGLE_SHEETS_ID);
        console.log('🔑 Credentials Path:', process.env.GOOGLE_SHEETS_CREDENTIALS_PATH);
        
        const profiles = await googleSheetsService.getProfileLinks();
        console.log(`✅ Successfully fetched ${profiles.length} profiles`);
        
        if (profiles.length === 0) {
            console.log('⚠️ Warning: No profiles found in the sheet');
        } else {
            console.log('📝 Sample profile fields:', Object.keys(profiles[0]));
        }
        
        res.json(profiles);
    } catch (error) {
        console.error('❌ Error fetching profiles:', error);
        res.status(500).json({ 
            error: error.message,
            details: 'Check server logs for more information',
            googleSheetId: process.env.GOOGLE_SHEETS_ID,
            credentialsPath: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH 
        });
    }
});

// Send message to a single profile
app.post('/api/message', async (req, res) => {
    let messenger = null;
    const startTime = new Date();
    console.log('\n=== NEW MESSAGE REQUEST ===');
    console.log('Timestamp:', startTime.toISOString());
    
    try {
        // Check if another message is being processed
        if (isMessaging) {
            console.log('❌ BLOCKED: Another message is being processed');
            return res.status(429).json({ 
                error: 'Another message is being processed. Please wait.'
            });
        }

        console.log('📨 Received message request:', req.body);
        const { profileUrl, message } = req.body;
        console.log('🎯 Target Profile URL:', profileUrl);
        
        if (!profileUrl || !message) {
            console.log('Missing required fields:', { profileUrl, message });
            return res.status(400).json({ error: 'Profile URL and message are required' });
        }

        isMessaging = true;

        console.log('🔄 Creating new browser session...');
        // Create new messenger session for this message
        messenger = await createNewMessengerSession();
        
        console.log('✍️ Setting message content...');
        // Set message
        messenger.message = message;

        console.log('🚀 Starting message flow for profile:', profileUrl);
        // Send message to profile
        const success = await messenger.automatedMessageFlow(profileUrl);
        
        // Log session details
        console.log('📊 Session Details:');
        console.log('- Session Duration:', `${(new Date() - startTime) / 1000}s`);
        console.log('- Profile URL:', profileUrl);
        console.log('- Message Length:', message.length);

        if (success) {
            console.log('Message sent successfully');
            res.json({ success: true, message: 'Message sent successfully' });
        } else {
            console.log('Failed to send message');
            throw new Error('Failed to send message');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ 
            error: error.message,
            details: 'Check server logs for more information'
        });
    } finally {
        // Always cleanup the session after message attempt
        if (messenger) {
            await cleanupSession(messenger);
        }
        isMessaging = false;
    }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT. Shutting down...');
    process.exit(0);
});

// Add a basic health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
    console.log(`\n=== SERVER STARTED ===`);
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Google Sheet ID: ${process.env.GOOGLE_SHEETS_ID}`);
    console.log(`📁 Credentials path: ${process.env.GOOGLE_SHEETS_CREDENTIALS_PATH}`);
    console.log(`\nTest the server:`);
    console.log(`Health check: http://localhost:${port}/api/health`);
    console.log(`Profiles endpoint: http://localhost:${port}/api/profiles`);
});