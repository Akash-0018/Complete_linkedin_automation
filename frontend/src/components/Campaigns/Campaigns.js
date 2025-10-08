import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { socket } from '../../services/websocket';
import './Campaigns.css';

function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    searchQuery: '',
    maxProfiles: 100
  });

  useEffect(() => {
    loadCampaigns();
    
    socket.on('campaignUpdate', (updatedCampaign) => {
      setCampaigns(prev => prev.map(camp => 
        camp.id === updatedCampaign.id ? updatedCampaign : camp
      ));
    });

    return () => {
      socket.off('campaignUpdate');
    };
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await axios.get('/api/campaigns');
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/campaigns', newCampaign);
      setNewCampaign({ name: '', searchQuery: '', maxProfiles: 100 });
      loadCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
    }
  };

  const handleCampaignAction = async (id, action) => {
    try {
      await axios.post(`/api/campaigns/${id}/${action}`);
      loadCampaigns();
    } catch (error) {
      console.error(`Error ${action} campaign:`, error);
    }
  };

  return (
    <div className="campaigns">
      <div className="campaigns-header">
        <h2>Campaigns</h2>
        <button className="new-campaign-btn" onClick={() => document.getElementById('newCampaignForm').classList.toggle('hidden')}>
          New Campaign
        </button>
      </div>

      <form id="newCampaignForm" className="campaign-form hidden" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Campaign Name</label>
          <input
            type="text"
            value={newCampaign.name}
            onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>Search Query</label>
          <input
            type="text"
            value={newCampaign.searchQuery}
            onChange={(e) => setNewCampaign({ ...newCampaign, searchQuery: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>Max Profiles</label>
          <input
            type="number"
            value={newCampaign.maxProfiles}
            onChange={(e) => setNewCampaign({ ...newCampaign, maxProfiles: parseInt(e.target.value) })}
            min="1"
            max="1000"
            required
          />
        </div>
        <button type="submit" className="submit-btn">Create Campaign</button>
      </form>

      <div className="campaigns-list">
        {campaigns.map(campaign => (
          <div key={campaign.id} className="campaign-card">
            <div className="campaign-header">
              <h3>{campaign.name}</h3>
              <span className={`status-badge ${campaign.status}`}>{campaign.status}</span>
            </div>
            <div className="campaign-details">
              <p><strong>Search Query:</strong> {campaign.searchQuery}</p>
              <p><strong>Progress:</strong> {campaign.processedProfiles} / {campaign.totalProfiles} profiles</p>
              <div className="progress-bar">
                <div 
                  className="progress-bar-fill"
                  style={{ width: `${(campaign.processedProfiles / campaign.totalProfiles * 100) || 0}%` }}
                />
              </div>
            </div>
            <div className="campaign-actions">
              {campaign.status === 'running' && (
                <button 
                  className="action-btn pause"
                  onClick={() => handleCampaignAction(campaign.id, 'pause')}
                >
                  Pause
                </button>
              )}
              {campaign.status === 'paused' && (
                <button 
                  className="action-btn resume"
                  onClick={() => handleCampaignAction(campaign.id, 'resume')}
                >
                  Resume
                </button>
              )}
              <button 
                className="action-btn delete"
                onClick={() => handleCampaignAction(campaign.id, 'delete')}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Campaigns;