import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

class GoogleSheetsService {
    constructor() {
        this.doc = null;
        this.credentials = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            // Load credentials
            const credentialsPath = join(__dirname, '..', process.env.GOOGLE_SHEETS_CREDENTIALS_PATH);
            this.credentials = JSON.parse(readFileSync(credentialsPath, 'utf-8'));

            // Create JWT client
            const client = new JWT({
                email: this.credentials.client_email,
                key: this.credentials.private_key,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            // Initialize document
            console.log('🔗 Connecting to Google Sheet...');
            this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, client);
            console.log('📄 Loading document info...');
            await this.doc.loadInfo();
            console.log('✅ Connected to document:', this.doc.title);
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize Google Sheets:', error);
            throw error;
        }
    }

    async getProfileLinks() {
        try {
            if (!this.initialized) {
                console.log('📡 Service not initialized, initializing now...');
                await this.initialize();
            }

            if (!this.doc) {
                throw new Error('Google Sheet document not initialized');
            }

            console.log('🔍 Fetching sheet data...');
            console.log('📊 Sheet ID:', process.env.GOOGLE_SHEETS_ID);
            
            // Get the first sheet
            const sheet = this.doc.sheetsByIndex[0];
            if (!sheet) {
                throw new Error('No sheets found in the document');
            }
            
            console.log(`📑 Sheet Title: ${sheet.title}`);
            console.log('🔄 Loading sheet metadata...');
            await sheet.loadHeaderRow();
            
            // Get and validate headers
            const headers = sheet.headerValues;
            if (!headers || headers.length === 0) {
                throw new Error('No headers found in sheet');
            }
            console.log('📋 Sheet Headers:', headers);
            
            // Get normalized headers (convert to lowercase for case-insensitive comparison)
            const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
            console.log('Normalized headers:', normalizedHeaders);

            // Define required columns and their possible variations
            const columnVariations = {
                profileUrl: ['profileurl', 'profile_url', 'profile url', 'url', 'linkedin url', 'linkedin_url', 'linkedinurl', 'linkedin profile'],
                status: ['status', 'state', 'profile_status', 'profilestatus'],
                phone_number: ['phone_number', 'phone', 'phonenumber', 'phone number', 'contact', 'contact_number', 'mobile', 'mobile_number']
            };

            // Create a mapping of actual header names to our standardized names
            const headerMapping = {};
            Object.entries(columnVariations).forEach(([standardName, variations]) => {
                const foundHeader = headers.find(h => 
                    variations.includes(h.toLowerCase().trim())
                );
                if (foundHeader) {
                    headerMapping[standardName] = foundHeader;
                    console.log(`✓ Found header for ${standardName}: ${foundHeader}`);
                } else {
                    console.log(`✗ No match found for ${standardName}`);
                    console.log('  Looked for:', variations);
                    console.log('  Available:', normalizedHeaders);
                }
            });

            // Check for missing required columns
            const missingColumns = [];
            if (!headerMapping.profileUrl) missingColumns.push('Profile URL');
            
            if (missingColumns.length > 0) {
                console.error('❌ Missing required columns!');
                console.error('Available headers:', headers);
                console.error('Acceptable variations:', columnVariations);
                throw new Error(`Could not find column for Profile URL. Please ensure your sheet has a column for LinkedIn profile URLs (can be named: URL, Profile URL, LinkedIn URL, etc).`);
            }

            // Log success
            console.log('✅ Found all required columns:', headerMapping);
            
            console.log('📥 Loading rows...');
            const rows = await sheet.getRows();
            console.log(`📊 Found ${rows.length} total rows`);
            
            if (rows.length === 0) {
                console.warn('⚠️ No data rows found in sheet');
                return [];
            }
            
            // Debug first row
            console.log('\n🔍 First Row Debug:');
            console.log('Raw data:', rows[0]?._rawData);
            console.log('Headers mapped to values:');
            headers.forEach(header => {
                console.log(`${header}: "${rows[0]?.get(header)}"`);
            });

            // Process each row with detailed logging
            console.log('\n🔄 Processing rows...');
            let processedCount = 0;
            let skippedCount = 0;
            
            const profiles = rows
                .filter(row => {
                    if (!row._rawData || row._rawData.length === 0) {
                        console.log('⏩ Skipping empty row');
                        skippedCount++;
                        return false;
                    }
                    return true;
                })
                .map(row => {
                    processedCount++;
                    const profile = {};
                    console.log(`\n👤 Processing row ${processedCount}:`);
                    
                    // Map the values using our header mapping
                    profile.profileUrl = row.get(headerMapping.profileUrl);
                    profile.status = row.get(headerMapping.status) || 'pending';
                    profile.phone_number = row.get(headerMapping.phone_number) || '';
                    
                    // Debug log
                    console.log(`   Profile URL: "${profile.profileUrl}"`);
                    console.log(`   Status: "${profile.status}"`);
                    console.log(`   Phone: "${profile.phone_number}"`);
                    
                    return profile;
                })
                .filter(profile => {
                    // Check for required URL
                    if (!profile.profileUrl) {
                        console.log('❌ Skipping: No profile URL');
                        skippedCount++;
                        return false;
                    }
                    
                    // Check status
                    const status = (profile.status || '').toLowerCase().trim();
                    const isValidStatus = !status || status === 'pending';
                    if (!isValidStatus) {
                        console.log(`❌ Skipping: Status is ${status}`);
                        skippedCount++;
                        return false;
                    }
                    
                    console.log('✅ Row valid');
                    return true;
                })
                .map(profile => ({
                    ...profile,
                    status: profile.status || 'pending'
                }));
            
            console.log('\n📊 Processing Summary:');
            console.log(`Total rows: ${rows.length}`);
            console.log(`Processed: ${processedCount}`);
            console.log(`Skipped: ${skippedCount}`);
            console.log(`Valid profiles: ${profiles.length}`);
            
            return profiles;
        } catch (error) {
            console.error('Failed to fetch profile links:', error);
            throw error;
        }
    }

    async updateProfileStatus(profileUrl, status) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const sheet = this.doc.sheetsByIndex[0];
            const rows = await sheet.getRows();
            
            const row = rows.find(row => row._rawData[0] === profileUrl);
            if (row) {
                row.status = status; // Use the header name to update
                await row.save();
                console.log(`Updated status for ${profileUrl} to ${status}`);
            } else {
                console.warn(`Profile ${profileUrl} not found in sheet`);
            }
        } catch (error) {
            console.error('Failed to update profile status:', error);
            throw error;
        }
    }
}

export default new GoogleSheetsService();