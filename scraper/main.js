#!/usr/bin/env node
const { program } = require('commander');
const inquirer = require('inquirer');
const ora = require('ora');
const config = require('./config');
const LinkedInScraper = require('./scraper');
const CampaignManager = require('./campaign');
const WorkerManager = require('./worker');
const { logger } = require('./logger');

// Initialize managers
const campaignManager = new CampaignManager();
const workerManager = new WorkerManager();

program
  .version('1.0.0')
  .description('LinkedIn Profile Scraper CLI');

// Single profile scraping
program
  .command('scrape <url>')
  .description('Scrape a single LinkedIn profile')
  .action(async (url) => {
    const spinner = ora('Scraping profile...').start();
    try {
      const scraper = new LinkedInScraper(
        process.env.LINKEDIN_EMAIL,
        process.env.LINKEDIN_PASSWORD
      );
      await scraper.initialize();
      const profile = await scraper.extractProfile(url);
      spinner.succeed('Profile scraped successfully');
      console.log(JSON.stringify(profile, null, 2));
    } catch (error) {
      spinner.fail(`Failed to scrape profile: ${error.message}`);
      process.exit(1);
    }
  });

// Campaign management
program
  .command('campaign')
  .description('Manage scraping campaigns')
  .option('-c, --create', 'Create new campaign')
  .option('-l, --list', 'List all campaigns')
  .option('-p, --pause <id>', 'Pause campaign')
  .option('-r, --resume <id>', 'Resume campaign')
  .action(async (cmd) => {
    try {
      if (cmd.create) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Campaign name:'
          },
          {
            type: 'input',
            name: 'schedule',
            message: 'Cron schedule (e.g., "0 9 * * 1-5" for weekdays at 9 AM):'
          },
          {
            type: 'input',
            name: 'targetList',
            message: 'Path to CSV/JSON file with target profiles:'
          }
        ]);

        const campaign = await campaignManager.createCampaign({
          ...answers,
          targetList: require(answers.targetList)
        });

        console.log(`Campaign created with ID: ${campaign.id}`);
      }

      if (cmd.list) {
        const campaigns = await campaignManager.db.Campaign.findAll();
        console.table(campaigns.map(c => ({
          ID: c.id,
          Name: c.name,
          Status: c.status,
          Progress: `${c.processedProfiles}/${c.totalProfiles}`,
          Success: `${((c.successfulProfiles / c.processedProfiles) * 100).toFixed(2)}%`,
          NextRun: c.nextRun
        })));
      }

      if (cmd.pause) {
        await campaignManager.pauseCampaign(cmd.pause);
        console.log(`Campaign ${cmd.pause} paused`);
      }

      if (cmd.resume) {
        await campaignManager.resumeCampaign(cmd.resume);
        console.log(`Campaign ${cmd.resume} resumed`);
      }
    } catch (error) {
      console.error('Campaign operation failed:', error.message);
      process.exit(1);
    }
  });

// Worker management
program
  .command('worker')
  .description('Manage worker processes')
  .option('-s, --start', 'Start worker processes')
  .option('-m, --metrics', 'Show worker metrics')
  .action(async (cmd) => {
    try {
      if (cmd.start) {
        await workerManager.initialize();
        console.log('Worker processes started');
      }

      if (cmd.metrics) {
        const metrics = workerManager.getMetrics();
        console.table(metrics);
      }
    } catch (error) {
      console.error('Worker operation failed:', error.message);
      process.exit(1);
    }
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal');
  await workerManager.gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT signal');
  await workerManager.gracefulShutdown();
  process.exit(0);
});

// Parse command line arguments
program.parse(process.argv);
