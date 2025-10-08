import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = {
    // Fetch profiles from Google Sheets
    getProfiles: async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/profiles`);
            return response.data;
        } catch (error) {
            console.error('Error fetching profiles:', error);
            throw error;
        }
    },

    // Send message to a single profile
    sendMessage: async (profileUrl, message) => {
        try {
            console.log('Sending message request:', { profileUrl, message });
            const response = await axios.post(`${API_BASE_URL}/message`, {
                profileUrl,
                message
            });
            console.log('Message sent successfully:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error sending message:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error || 'Failed to send message. Please try again.');
        }
    },

    // Trigger phone contact workflow via n8n webhook
    triggerPhoneContact: async (profileData) => {
        try {
            console.log('Triggering n8n webhook for phone contact:', profileData);
            const webhookUrl = 'https://akash0018.app.n8n.cloud/webhook/trigger-call';
            
            // Prepare Retell AI payload
            const retellPayload = {
                from_number: "+17034982589",  // Your Retell AI phone number
                to_number: profileData.phone_number.startsWith('+') 
                    ? profileData.phone_number 
                    : `+91${profileData.phone_number}`, // Adding +91 prefix if not present
                agent_id: "agent_20b97b3d3f13bd36a56b1871f3",
                agent_version: 1,
                metadata: {
                    campaign: "LinkedIn_Outreach",
                    profile_url: profileData.profileUrl
                },
                retell_llm_dynamic_variables: {
                    customer_name: profileData.name || "there", // Default to "there" if name not available
                    preferred_language: "Tamil"
                }
            };

            // Send data to n8n webhook
            const webhookResponse = await axios.post(webhookUrl, retellPayload);
            console.log('N8n webhook response:', webhookResponse.data);

            // If webhook was successful, update the profile status
            if (webhookResponse.data.success) {
                await axios.post(`${API_BASE_URL}/phone-contact`, {
                    profile: {
                        ...profileData,
                        status: 'phone_contact_triggered'
                    }
                });
            }

            return {
                success: true,
                message: 'Phone contact workflow triggered successfully',
                webhookResponse: webhookResponse.data
            };
        } catch (error) {
            console.error('Error triggering phone contact:', error.response?.data || error.message);
            throw new Error(
                error.response?.data?.error || 
                'Failed to trigger phone contact workflow. Please check the webhook configuration.'
            );
        }
    }
};

export default api;
