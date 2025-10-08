import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import api from '../services/api';

const ProfileList = () => {
  // State declarations including the missing 'success'
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const navigate = useNavigate();

  // Debug function to log profile data
  const logProfileData = (data) => {
    console.log('Received profiles:', data);
    console.log('First profile fields:', data[0] ? Object.keys(data[0]) : 'No profiles');
  };

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);  // Reset success on new fetch

    try {
      console.log('Fetching profiles from API...');
      const response = await api.getProfiles();
      console.log('API Response:', response);
      
      if (!Array.isArray(response)) {
        throw new Error('Invalid response format: expected an array');
      }
      
      logProfileData(response);
      setProfiles(response);
      
      if (response.length === 0) {
        setError('No profiles found. Please check your Google Sheet.');
      }
    } catch (err) {
      console.error('Error fetching profiles:', err);
      setError(
        `Failed to fetch profiles: ${err.response?.data?.error || err.message}. ` +
        'Please check the server connection and Google Sheets setup.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSelect = (profile) => {
    // Log profile info for debugging
    console.log('Selected profile:', profile);
    console.log('Profile fields:', Object.keys(profile));
    console.log('Phone number:', profile.phone_number);

    if (profile.phone_number?.trim()) {
      navigate('/webhook-contact', { state: { profile } });
    } else {
      navigate('/linkedin-message', { state: { profile } });
    }
  };

  return (
    <Container maxWidth="lg">
      <Box my={4}>
        <Typography variant="h4" gutterBottom>
          LinkedIn Profiles
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            {profiles.length === 0 && (
              <div style={{ marginTop: '10px', fontSize: '0.9em' }}>
                Tips:
                <ul>
                  <li>Ensure your Google Sheet has the correct columns (profileUrl, status, phone_number)</li>
                  <li>Check if the Google Sheet ID in your .env file is correct</li>
                  <li>Verify that the backend server is running on port 3001</li>
                </ul>
              </div>
            )}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {loading && profiles.length === 0 ? (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Profile Link</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Phone Number</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Action</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {profiles.map((profile) => (
                  <TableRow
                    key={profile.profileUrl}
                    onClick={() => profile.status === 'pending' && handleProfileSelect(profile)}
                    sx={{
                      backgroundColor:
                        profile.status === 'completed'
                          ? '#e8f5e9'
                          : profile.status === 'failed'
                          ? '#ffebee'
                          : profile.status === 'phone_contact_triggered'
                          ? '#e3f2fd'
                          : 'inherit',
                      '&:hover': {
                        backgroundColor: profile.status === 'pending' ? '#f5f5f5' : 'inherit',
                        cursor: profile.status === 'pending' ? 'pointer' : 'default'
                      },
                    }}
                  >
                    <TableCell>{profile.profileUrl}</TableCell>
                    <TableCell>{profile.status}</TableCell>
                    <TableCell>{profile.phone_number || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="contained"
                        color={profile.phone_number ? 'secondary' : 'primary'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (profile.status === 'pending') handleProfileSelect(profile);
                        }}
                        disabled={profile.status !== 'pending'}
                        size="small"
                      >
                        {profile.status !== 'pending'
                          ? profile.status
                          : profile.phone_number
                          ? 'Trigger Webhook'
                          : 'Send Message'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Container>
  );
};

export default ProfileList;
