import React, { useState } from 'react';
import {
    Container,
    Paper,
    Box,
    Typography,
    Button,
    CircularProgress,
    IconButton,
    Card,
    CardContent,
    Chip
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PhoneIcon from '@mui/icons-material/Phone';
import PersonIcon from '@mui/icons-material/Person';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import api from '../../services/api';

import './WebhookContact.css';

const WebhookContact = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const profile = location.state?.profile;
    
    const [loading, setLoading] = useState(false);

    if (!profile) {
        navigate('/');
        return null;
    }

    const handleTriggerWebhook = async () => {
        try {
            setLoading(true);
            const response = await api.triggerPhoneContact(profile);
            
            if (response.webhookResponse?.success) {
                // Navigate back immediately on success
                navigate('/');
            }
        } catch (err) {
            console.error('Webhook error:', err);
            // Continue showing the error in the console but don't display it to the user
        } finally {
            setLoading(false);
        }
    };

    const getProfileName = () => {
        return profile.name || profile.profileUrl.split('/').pop()?.replace(/-/g, ' ') || 'Contact';
    };

    return (
        <Container maxWidth="md" className="webhook-container">
            <Box className="page-header">
                <IconButton 
                    className="back-button"
                    onClick={() => navigate('/')}
                    aria-label="back"
                >
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h5" sx={{ fontWeight: 500, color: '#202124' }}>
                    Initiate Phone Contact
                </Typography>
            </Box>

            <Card className="content-card">
                <CardContent sx={{ p: 3 }}>
                    <Box className="profile-info">
                        <Box className="info-row">
                            <PersonIcon />
                            <Typography>
                                {getProfileName()}
                            </Typography>
                            <Chip 
                                label={profile.status || 'pending'}
                                className={`status-chip ${profile.status || 'pending'}`}
                                size="small"
                            />
                        </Box>

                        <Box className="info-row">
                            <PhoneIcon />
                            <Typography>
                                {profile.phone_number}
                            </Typography>
                        </Box>

                        <Box className="info-row">
                            <LinkedInIcon />
                            <Typography 
                                component="a" 
                                href={profile.profileUrl} 
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ 
                                    color: 'inherit', 
                                    textDecoration: 'none',
                                    '&:hover': { textDecoration: 'underline' }
                                }}
                            >
                                View LinkedIn Profile
                            </Typography>
                        </Box>
                    </Box>

                    <Button
                        className="action-button"
                        onClick={handleTriggerWebhook}
                        disabled={loading}
                        fullWidth
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PhoneIcon />}
                    >
                        {loading ? 'Initiating Call...' : 'Trigger Phone Call'}
                    </Button>
                </CardContent>
            </Card>
        </Container>
    );
};

export default WebhookContact;