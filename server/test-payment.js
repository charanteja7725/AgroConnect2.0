const axios = require('axios');

async function testDeliveryPartnerAssignment() {
  try {
    // First, login as admin to get token
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@test.com',
      password: 'test123'
    });

    const token = loginResponse.data.token;
    console.log('Logged in as admin, token:', token.substring(0, 20) + '...');

    // Set authorization header for subsequent requests
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };

    // Test finding nearby delivery partners
    const nearbyResponse = await axios.get('http://localhost:5001/api/delivery/nearby', {
      params: {
        latitude: 12.9716,
        longitude: 77.5946,
        maxDistance: 50000 // 50km
      },
      ...config
    });

    console.log('Nearby delivery partners query successful:', nearbyResponse.data);

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testDeliveryPartnerAssignment();