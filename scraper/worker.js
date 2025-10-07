// Worker queue system for concurrent processing
const Queue = require('bull');
const cluster = require('cluster');
const os = require('os');
const config = require('./config');
const { logger } = require('./logger');
const LinkedInScraper = require('./scraper');
const CampaignManager = require('./campaign');

class WorkerManager {
  constructor() {
    this.scrapeQueue = new Queue('profile-scraping', {
      redis: config.REDIS_URL,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    });

    this.campaignManager = new CampaignManager();
    this.metrics = {
      activeWorkers: 0,
      completedJobs: 0,
      failedJobs: 0,
      avgProcessingTime: 0
    };
  }

  async initialize() {
    if (cluster.isMaster) {
      this.initializeMaster();
    } else {
      this.initializeWorker();
    }
  }

  initializeMaster() {
    const numWorkers = Math.min(
      os.cpus().length,
      config.MAX_CONCURRENT_WORKERS || 4
    );

    logger.info(`Starting ${numWorkers} workers`);

    // Fork workers
    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }

    // Handle worker events
    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.id} died. Restarting...`);
      cluster.fork();
    });

    // Monitor queue health
    this.monitorQueueHealth();
  }

  async initializeWorker() {
    const scraper = new LinkedInScraper(
      process.env.LINKEDIN_EMAIL,
      process.env.LINKEDIN_PASSWORD
    );

    // Process jobs
    this.scrapeQueue.process(async (job) => {
      const { profileUrl, campaignId } = job.data;
      
      try {
        await scraper.initialize();
        const profile = await scraper.extractProfile(profileUrl);
        
        // Update progress
        job.progress(100);
        
        return profile;
      } catch (error) {
        logger.error(`Worker ${cluster.worker.id} failed to process profile`, {
          profileUrl,
          error: error.message
        });
        throw error;
      }
    });

    // Handle failed jobs
    this.scrapeQueue.on('failed', async (job, error) => {
      this.metrics.failedJobs++;
      await this.campaignManager.sendWebhook('job.failed', {
        jobId: job.id,
        campaignId: job.data.campaignId,
        error: error.message
      });
    });

    // Handle completed jobs
    this.scrapeQueue.on('completed', async (job, result) => {
      this.metrics.completedJobs++;
      const processingTime = Date.now() - job.timestamp;
      this.metrics.avgProcessingTime = 
        (this.metrics.avgProcessingTime * (this.metrics.completedJobs - 1) + processingTime) / 
        this.metrics.completedJobs;
    });
  }

  async addProfilesToQueue(profiles, campaignId) {
    const jobs = profiles.map(profileUrl => ({
      name: 'scrape-profile',
      data: {
        profileUrl,
        campaignId,
        timestamp: Date.now()
      }
    }));

    await this.scrapeQueue.addBulk(jobs);
  }

  async monitorQueueHealth() {
    setInterval(async () => {
      const jobCounts = await this.scrapeQueue.getJobCounts();
      const workers = await this.scrapeQueue.getWorkers();
      
      this.metrics.activeWorkers = workers.length;
      
      logger.info('Queue health check', {
        waiting: jobCounts.waiting,
        active: jobCounts.active,
        completed: jobCounts.completed,
        failed: jobCounts.failed,
        delayed: jobCounts.delayed,
        workers: this.metrics.activeWorkers,
        avgProcessingTime: this.metrics.avgProcessingTime
      });

      // Auto-scale workers if needed
      this.autoScaleWorkers(jobCounts);
    }, config.HEALTH_CHECK_INTERVAL);
  }

  async autoScaleWorkers(jobCounts) {
    const currentWorkers = this.metrics.activeWorkers;
    const waitingJobs = jobCounts.waiting;
    const maxWorkers = config.MAX_CONCURRENT_WORKERS;
    
    // Scale up if too many waiting jobs
    if (waitingJobs > currentWorkers * 2 && currentWorkers < maxWorkers) {
      cluster.fork();
      logger.info('Scaling up workers');
    }
    
    // Scale down if too few jobs
    if (waitingJobs === 0 && currentWorkers > 1) {
      const workerId = Object.keys(cluster.workers)[0];
      cluster.workers[workerId].kill();
      logger.info('Scaling down workers');
    }
  }

  async gracefulShutdown() {
    logger.info('Initiating graceful shutdown');

    // Stop accepting new jobs
    await this.scrapeQueue.pause(true);

    // Wait for active jobs to complete
    const active = await this.scrapeQueue.getActive();
    const activeJobIds = active.map(job => job.id);

    if (activeJobIds.length > 0) {
      logger.info(`Waiting for ${activeJobIds.length} active jobs to complete`);
      await Promise.all(
        activeJobIds.map(jobId => 
          this.scrapeQueue.getJob(jobId).then(job => job.finished())
        )
      );
    }

    // Close queue
    await this.scrapeQueue.close();

    // Terminate workers
    if (cluster.isMaster) {
      Object.values(cluster.workers).forEach(worker => {
        worker.kill();
      });
    }

    logger.info('Shutdown complete');
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = WorkerManager;