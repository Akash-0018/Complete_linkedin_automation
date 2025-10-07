// Enhanced Google Sheets integration with batch operations and multiple sheet management
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { logger } = require('./logger');
const config = require('./config');

class SheetsManager {
  constructor(credentials, spreadsheetId) {
    this.spreadsheetId = spreadsheetId;
    this.credentials = credentials;
    this.batchSize = 100;
    this.pendingWrites = [];
    this.sheetsClient = null;
  }

  async initialize() {
    const { client_email, private_key } = this.credentials;
    const auth = new google.auth.JWT(
      client_email,
      null,
      private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    await auth.authorize();
    this.sheetsClient = google.sheets({ version: 'v4', auth });
  }

  formatProfile(profile) {
    return [
      profile.name || '',
      profile.title || '',
      profile.location || '',
      profile.email || '',
      profile.phone || '',
      (profile.experience || []).join('; '),
      (profile.education || []).join('; '),
      (profile.skills || []).join('; '),
      profile.about || '',
      profile.additionalEmails?.join('; ') || '',
      profile.additionalPhones?.join('; ') || '',
      new Date().toISOString()
    ];
  }

  async ensureHeaders() {
    const headers = [
      ['Name', 'Title', 'Location', 'Email', 'Phone', 'Experience', 
       'Education', 'Skills', 'About', 'Additional Emails', 
       'Additional Phones', 'Scraped Date']
    ];

    await this.sheetsClient.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: 'Sheet1!A1:L1',
      valueInputOption: 'RAW',
      resource: { values: headers }
    });
  }

  async appendProfile(profile) {
    this.pendingWrites.push(this.formatProfile(profile));
    
    if (this.pendingWrites.length >= this.batchSize) {
      await this.flushWrites();
    }
  }

  async flushWrites() {
    if (this.pendingWrites.length === 0) return;

    try {
      await this.sheetsClient.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A2',
        valueInputOption: 'RAW',
        resource: { values: this.pendingWrites }
      });

      logger.info(`Batch write successful: ${this.pendingWrites.length} profiles`);
      this.pendingWrites = [];
    } catch (error) {
      logger.error('Failed to write batch to Google Sheets', { error });
      await this.createBackup();
      throw error;
    }
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    const csvWriter = createCsvWriter({
      path: path.join(backupDir, `profiles-backup-${timestamp}.csv`),
      header: [
        { id: 'name', title: 'Name' },
        { id: 'title', title: 'Title' },
        { id: 'location', title: 'Location' },
        { id: 'email', title: 'Email' },
        { id: 'phone', title: 'Phone' },
        { id: 'experience', title: 'Experience' },
        { id: 'education', title: 'Education' },
        { id: 'skills', title: 'Skills' },
        { id: 'about', title: 'About' },
        { id: 'additionalEmails', title: 'Additional Emails' },
        { id: 'additionalPhones', title: 'Additional Phones' },
        { id: 'scrapedDate', title: 'Scraped Date' }
      ]
    });

    const records = this.pendingWrites.map(row => ({
      name: row[0],
      title: row[1],
      location: row[2],
      email: row[3],
      phone: row[4],
      experience: row[5],
      education: row[6],
      skills: row[7],
      about: row[8],
      additionalEmails: row[9],
      additionalPhones: row[10],
      scrapedDate: row[11]
    }));

    await csvWriter.writeRecords(records);
    logger.info(`Backup created: profiles-backup-${timestamp}.csv`);
  }
}

module.exports = SheetsManager;
