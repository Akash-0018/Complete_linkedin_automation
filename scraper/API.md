# API Routes Documentation

## Campaign Management

### Create Campaign
POST /api/campaigns
```json
{
  "name": "Campaign Name",
  "schedule": "0 9 * * 1-5",
  "targetList": ["url1", "url2"],
  "config": {
    "delay": 5000,
    "maxProfiles": 100
  }
}
```

### List Campaigns
GET /api/campaigns

## Profile Scraping

### Scrape Single Profile
POST /api/scrape/profile
```json
{
  "url": "https://linkedin.com/in/profile"
}
```

### Search Profiles
POST /api/scrape/search
```json
{
  "keywords": "software engineer",
  "filters": {
    "location": "United States",
    "company": "Google"
  }
}
```

## Worker Management

### Get Worker Status
GET /api/workers/status

### Scale Workers
POST /api/workers/scale
```json
{
  "count": 5
}
```

## Dashboard

### Get Statistics
GET /api/dashboard/stats

## WebSocket Events

### Campaign Updates
- Event: `campaign:update`
- Subscribe: `socket.emit('subscribe:campaign', campaignId)`

### Worker Updates
- Event: `workers:update`
- Subscribe: `socket.emit('subscribe:workers')`