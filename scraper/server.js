// Main Express server integrating all components
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const LinkedInScraper = require('./scraper');
const CampaignManager = require('./campaign');
const WorkerManager = require('./worker');
const DashboardServer = require('./dashboard');
const config = require('./config');
const { logger } = require('./logger');

class MainServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    });

    // Initialize components
    this.campaignManager = new CampaignManager();
    this.workerManager = new WorkerManager();
    this.dashboardServer = new DashboardServer();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.url}`);
      next();
    });
  }

  setupRoutes() {
    // Campaign routes
    this.app.post('/api/campaigns', async (req, res) => {
      try {
        const campaign = await this.campaignManager.createCampaign(req.body);
        res.json(campaign);
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

    // Profile scraping routes
    this.app.post('/api/scrape/profile', async (req, res) => {
      try {
        const { url } = req.body;
        const scraper = new LinkedInScraper(
          process.env.LINKEDIN_EMAIL,
          process.env.LINKEDIN_PASSWORD
        );
        await scraper.initialize();
        const profile = await scraper.extractProfile(url);
        res.json(profile);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/scrape/search', async (req, res) => {
      try {
        const { keywords, filters } = req.body;
        const scraper = new LinkedInScraper(
          process.env.LINKEDIN_EMAIL,
          process.env.LINKEDIN_PASSWORD
        );
        await scraper.initialize();
        const profiles = await scraper.searchProfiles(keywords, filters);
        res.json(profiles);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Worker management routes
    this.app.get('/api/workers/status', (req, res) => {
      const metrics = this.workerManager.getMetrics();
      res.json(metrics);
    });

    this.app.post('/api/workers/scale', async (req, res) => {
      try {
        const { count } = req.body;
        await this.workerManager.scaleWorkers(count);
        res.json({ status: 'success' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Dashboard routes
    this.app.get('/api/dashboard/stats', async (req, res) => {
      try {
        const stats = await this.dashboardServer.getStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Error handling
    this.app.use((err, req, res, next) => {
      logger.error('Server error', { error: err });
      res.status(500).json({ error: err.message });
    });
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      logger.info('Client connected');

      // Subscribe to campaign updates
      socket.on('subscribe:campaign', (campaignId) => {
        socket.join(`campaign:${campaignId}`);
      });

      // Subscribe to worker updates
      socket.on('subscribe:workers', () => {
        socket.join('workers');
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected');
      });
    });

    // Emit campaign updates
    this.campaignManager.on('campaign:update', (data) => {
      this.io.to(`campaign:${data.campaignId}`).emit('campaign:update', data);
    });

    // Emit worker updates
    this.workerManager.on('workers:update', (data) => {
      this.io.to('workers').emit('workers:update', data);
    });
  }

  start() {
    const port = process.env.PORT || 4000;
    this.server.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  }

  async stop() {
    await this.campaignManager.cleanup();
    await this.workerManager.gracefulShutdown();
    await this.dashboardServer.stop();
    
    return new Promise((resolve) => {
      this.server.close(resolve);
    });
  }
}

// Start server if running directly
if (require.main === module) {
  const server = new MainServer();
  server.start();

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}

module.exports = MainServer;