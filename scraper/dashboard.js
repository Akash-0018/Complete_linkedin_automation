// Express server for monitoring dashboard
const express = require('express');
const { createServer } = require('http');
const CampaignManager = require('./campaign');
const WorkerManager = require('./worker');
const config = require('./config');
const { logger } = require('./logger');

class DashboardServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.campaignManager = new CampaignManager();
    this.workerManager = new WorkerManager();
    this.setupRoutes();
  }

  setupRoutes() {
    // API endpoints
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    this.app.get('/api/stats', async (req, res) => {
      try {
        const campaignStats = await this.campaignManager.getStats();
        const workerStats = this.workerManager.getMetrics();
        res.json({
          campaigns: campaignStats,
          workers: workerStats,
          system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/campaigns', async (req, res) => {
      try {
        const campaigns = await this.campaignManager.db.Campaign.findAll();
        res.json(campaigns);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/campaigns/:id/pause', async (req, res) => {
      try {
        await this.campaignManager.pauseCampaign(req.params.id);
        res.json({ status: 'paused' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/campaigns/:id/resume', async (req, res) => {
      try {
        await this.campaignManager.resumeCampaign(req.params.id);
        res.json({ status: 'resumed' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/accounts', async (req, res) => {
      try {
        const accounts = await this.campaignManager.db.Account.findAll();
        res.json(accounts);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/queue/status', async (req, res) => {
      try {
        const queueStats = await this.workerManager.scrapeQueue.getJobCounts();
        res.json(queueStats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Error handling
    this.app.use((err, req, res, next) => {
      logger.error('Dashboard server error', { error: err });
      res.status(500).json({ error: err.message });
    });
  }

  start() {
    const port = process.env.DASHBOARD_PORT || 3000;
    this.server.listen(port, () => {
      logger.info(`Dashboard server running on port ${port}`);
    });
  }

  stop() {
    return new Promise((resolve) => {
      this.server.close(resolve);
    });
  }
}

module.exports = DashboardServer;