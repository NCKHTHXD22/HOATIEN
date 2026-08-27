require('dotenv').config();
const { connectDatabases, disconnectDatabases } = require('./src/config/database');
const ZaloConfigRepo = require('./src/repositories/mongo/ZaloConfigRepo');
const axios = require('axios');

async function test() {
  await connectDatabases();
  const token = await ZaloConfigRepo.getValidToken();
  const userId = "3689754700559421830";
  
  // Try v2.0
  try {
    const res = await axios.post(
      "https://openapi.zalo.me/v2.0/oa/message",
      { recipient: { user_id: userId }, message: { text: "Test from v2.0 API" } },
      { headers: { access_token: token } }
    );
    console.log("v2.0 Response:", res.data);
  } catch (e) {
    console.error("v2.0 Error:", e.response ? e.response.data : e.message);
  }

  // Try v3.0 transaction
  try {
    const res2 = await axios.post(
      "https://openapi.zalo.me/v3.0/oa/message/transaction",
      { 
        recipient: { user_id: userId }, 
        message: { 
          text: "Test from v3.0 transaction API",
          template_type: "transaction_text"
        } 
      },
      { headers: { access_token: token } }
    );
    console.log("v3.0 transaction Response:", res2.data);
  } catch (e) {
    console.error("v3.0 transaction Error:", e.response ? e.response.data : e.message);
  }
  
  await disconnectDatabases();
}

test();
