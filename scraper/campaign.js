// Campaign management and scheduling
const cron = require('node-cron');
const { EventEmitter } = require('events');
const { Sequelize, DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const config = require('./config');
const { logger } = require('./logger');

class CampaignManager extends EventEmitter {
  constructor() {
    super();
    this.db = this.initializeDatabase();
    this.activeJobs = new Map();
    this.initialize();
  }

  async initializeDatabase() {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: './campaigns.db',
      logging: false
    });

    // Campaign Model
    const Campaign = sequelize.define('Campaign', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: DataTypes.STRING,
      status: DataTypes.STRING,
      schedule: DataTypes.STRING,
      accountId: DataTypes.STRING,
      targetList: DataTypes.TEXT,
      totalProfiles: DataTypes.INTEGER,
      processedProfiles: DataTypes.INTEGER,
      successfulProfiles: DataTypes.INTEGER,
      failedProfiles: DataTypes.INTEGER,
      lastRun: DataTypes.DATE,
      nextRun: DataTypes.DATE,
      config: DataTypes.TEXT
    });

    // Account Model
    const Account = sequelize.define('Account', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      email: DataTypes.STRING,
      status: DataTypes.STRING,
      lastUsed: DataTypes.DATE,
      dailyQuota: DataTypes.INTEGER,
      usedQuota: DataTypes.INTEGER,
      errorCount: DataTypes.INTEGER,
      cookieData: DataTypes.TEXT
    });

    await sequelize.sync();
    return { sequelize, Campaign, Account };
  }

  async initialize() {
    // Resume active campaigns
    const activeCampaigns = await this.db.Campaign.findAll({
      where: { status: 'active' }
    });

    for (const campaign of activeCampaigns) {
      this.scheduleCampaign(campaign);
    }
  }

  async createCampaign(data) {
    const campaign = await this.db.Campaign.create({
      id: uuidv4(),
      name: data.name,
      status: 'active',
      schedule: data.schedule,
      accountId: data.accountId,
      targetList: JSON.stringify(data.targetList),
      totalProfiles: data.targetList.length,
      processedProfiles: 0,
      successfulProfiles: 0,
      failedProfiles: 0,
      config: JSON.stringify(data.config || {})
    });

    this.scheduleCampaign(campaign);
    return campaign;
  }

  scheduleCampaign(campaign) {
    if (this.activeJobs.has(campaign.id)) {
      this.activeJobs.get(campaign.id).destroy();
    }

    const job = cron.schedule(campaign.schedule, async () => {
      await this.runCampaign(campaign.id);
    });

    this.activeJobs.set(campaign.id, job);
  }

  async runCampaign(campaignId) {
    const campaign = await this.db.Campaign.findByPk(campaignId);
    if (!campaign || campaign.status !== 'active') return;

    const account = await this.db.Account.findByPk(campaign.accountId);
    if (!account || account.status !== 'active') {
      logger.error(`Account not available for campaign ${campaignId}`);
      return;
    }

    try {
      campaign.lastRun = new Date();
      await campaign.save();

      const targetList = JSON.parse(campaign.targetList);
      const config = JSON.parse(campaign.config);
      
      // Update next run time based on cron schedule
      const interval = cron.parseExpression(campaign.schedule);
      campaign.nextRun = interval.next().toDate();
      await campaign.save();

      // Notify campaign start
      await this.sendWebhook('campaign.started', {
        campaignId,
        name: campaign.name,
        totalProfiles: campaign.totalProfiles
      });

      // Execute scraping
      const results = await this.executeScraping(targetList, account, config);

      // Update campaign statistics
      campaign.processedProfiles += results.processed;
      campaign.successfulProfiles += results.successful;
      campaign.failedProfiles += results.failed;
      await campaign.save();

      // Notify campaign completion
      await this.sendWebhook('campaign.completed', {
        campaignId,
        name: campaign.name,
        results
      });

    } catch (error) {
      logger.error(`Campaign ${campaignId} failed`, { error });
      await this.sendWebhook('campaign.error', {
        campaignId,
        name: campaign.name,
        error: error.message
      });
    }
  }

  async executeScraping(targetList, account, config) {
    // Implement the actual scraping logic here
    const results = {
      processed: 0,
      successful: 0,
      failed: 0
    };

    // Update account quota
    account.usedQuota += results.successful;
    await account.save();

    return results;
  }

  async pauseCampaign(campaignId) {
    const campaign = await this.db.Campaign.findByPk(campaignId);
    if (!campaign) return;

    campaign.status = 'paused';
    await campaign.save();

    if (this.activeJobs.has(campaignId)) {
      this.activeJobs.get(campaignId).destroy();
      this.activeJobs.delete(campaignId);
    }
  }

  async resumeCampaign(campaignId) {
    const campaign = await this.db.Campaign.findByPk(campaignId);
    if (!campaign) return;

    campaign.status = 'active';
    await campaign.save();
    this.scheduleCampaign(campaign);
  }

  async sendWebhook(event, data) {
    if (!config.WEBHOOK_URL) return;

    try {
      await axios.post(config.WEBHOOK_URL, {
        event,
        timestamp: new Date().toISOString(),
        data
      });
    } catch (error) {
      logger.error('Webhook delivery failed', { error });
    }
  }

  async getStats() {
    const campaigns = await this.db.Campaign.findAll();
    const accounts = await this.db.Account.findAll();

    return {
      campaigns: campaigns.length,
      activeAccounts: accounts.filter(a => a.status === 'active').length,
      totalProfilesProcessed: campaigns.reduce((sum, c) => sum + c.processedProfiles, 0),
      successRate: campaigns.reduce((sum, c) => sum + c.successfulProfiles, 0) / 
                  campaigns.reduce((sum, c) => sum + c.processedProfiles, 0) * 100
    };
  }
}

module.exports = CampaignManager;