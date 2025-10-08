import React, { useEffect, useState } from 'react';
import { socket } from '../../services/websocket';
import axios from 'axios';
import './Dashboard.css';

function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({
    active: 0,
    completed: 0,
    failed: 0,
    totalProfiles: 0
  });

  useEffect(() => {
    // Fetch campaigns
    const fetchCampaigns = async () => {
      try {
        const response = await axios.get('/api/campaigns');
        setCampaigns(response.data);
        updateStats(response.data);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
      }
    };

    fetchCampaigns();

    // Listen for campaign updates
    socket.on('campaignUpdate', (updatedCampaign) => {
      setCampaigns(prev => {
        const newCampaigns = prev.map(campaign => 
          campaign.id === updatedCampaign.id ? updatedCampaign : campaign
        );
        updateStats(newCampaigns);
        return newCampaigns;
      });
    });

    return () => {
      socket.off('campaignUpdate');
    };
  }, []);

  const updateStats = (campaignData) => {
    setStats({
      active: campaignData.filter(c => c.status === 'running').length,
      completed: campaignData.filter(c => c.status === 'completed').length,
      failed: campaignData.filter(c => c.status === 'failed').length,
      totalProfiles: campaignData.reduce((acc, c) => acc + (c.totalProfiles || 0), 0)
    });
  };

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Active Campaigns</h3>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="stat-card">
          <h3>Completed</h3>
          <div className="stat-value success">{stats.completed}</div>
        </div>
        <div className="stat-card">
          <h3>Failed</h3>
          <div className="stat-value error">{stats.failed}</div>
        </div>
        <div className="stat-card">
          <h3>Total Profiles</h3>
          <div className="stat-value">{stats.totalProfiles}</div>
        </div>
      </div>

      <div className="campaigns-table">
        <h2>Recent Campaigns</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Profiles</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(campaign => (
              <tr key={campaign.id}>
                <td>{campaign.name}</td>
                <td>
                  <span className={`status-badge ${campaign.status}`}>
                    {campaign.status}
                  </span>
                </td>
                <td>
                  <div className="progress-bar">
                    <div 
                      className="progress-bar-fill"
                      style={{ width: `${(campaign.processedProfiles / campaign.totalProfiles * 100) || 0}%` }}
                    />
                  </div>
                </td>
                <td>{campaign.processedProfiles} / {campaign.totalProfiles}</td>
                <td>{new Date(campaign.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;