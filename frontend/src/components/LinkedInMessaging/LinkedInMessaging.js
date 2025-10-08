import React, { useState } from 'react';
import {
    Container,
    Box,
    Typography,
    TextField,
    Button,
    CircularProgress,
    IconButton,
    Card,
    CardContent,
    Chip
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import api from '../../services/api';
import './LinkedInMessaging.css';

const LinkedInMessaging = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const profile = location.state?.profile;
    
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    if (!profile) {
        navigate('/');
        return null;
    }

    const handleMessageChange = (event) => {
        setMessage(event.target.value);
    };

    const handleSendMessage = async () => {
        if (!message) {
            setError('Please enter a message.');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            await api.sendMessage(profile.profileUrl, message);
            setSuccess('Message sent successfully!');
            setTimeout(() => navigate('/'), 2000);
        } catch (err) {
            setError(err.message || 'Failed to send message. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="md" className="messaging-container">
            <Box className="page-header">
                <IconButton 
                    className="back-button"
                    onClick={() => navigate('/')}
                    aria-label="back"
                >
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h5" sx={{ fontWeight: 500, color: '#202124' }}>
                    Send LinkedIn Message
                </Typography>
            </Box>

            <Card className="content-card">
                <CardContent sx={{ p: 3 }}>
                    <Box className="profile-info">
                        <Box className="info-row">
                            <PersonIcon />
                            <Typography>
                                {profile.name || profile.profileUrl.split('/').pop()?.replace(/-/g, ' ') || 'Contact'}
                            </Typography>
                            <Chip 
                                label={profile.status || 'pending'}
                                className={`status-chip ${profile.status || 'pending'}`}
                                size="small"
                            />
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

                    <TextField
                        className="message-field"
                        fullWidth
                        multiline
                        rows={4}
                        variant="outlined"
                        label="Type your message"
                        placeholder="Enter your LinkedIn message here..."
                        value={message}
                        onChange={handleMessageChange}
                        disabled={loading}
                    />

                    <Button
                        className="action-button"
                        onClick={handleSendMessage}
                        disabled={!message || loading}
                        fullWidth
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                    >
                        {loading ? 'Sending Message...' : 'Send LinkedIn Message'}
                    </Button>
                </CardContent>
            </Card>
        </Container>
    );
};

export default LinkedInMessaging;