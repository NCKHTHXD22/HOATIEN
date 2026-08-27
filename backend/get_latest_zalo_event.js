const mongoose = require('mongoose');
require('dotenv').config();

const ZaloEvent = require('./src/models/mongo/ZaloEvent');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const event = await ZaloEvent.findOne().sort({ timestamp: -1 });
    if (event) {
      console.log('--- LATEST ZALO EVENT ---');
      console.log('Zalo User ID:', event.zaloUserId);
      console.log('Type:', event.type);
      console.log('Timestamp:', event.timestamp);
      console.log('Payload:', JSON.stringify(event.payload, null, 2));
    } else {
      console.log('No Zalo events found.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
