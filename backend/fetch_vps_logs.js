const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Client Ready - Checking Cloudinary Config...');
  const nodeCmd = `cd /var/www/hoatien/backend && node -e "
    require('dotenv').config();
    console.log(JSON.stringify({
      CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET
    }, null, 2));
    process.exit(0);
  "`;
  
  conn.exec(nodeCmd, (err, stream) => {
    if (err) throw err;
    console.log('=== CLOUDINARY CONFIG CHECK ===');
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '123.30.48.104',
  port: 22,
  username: 'root',
  password: '3ABSP3WQ23NQHPPMB9YyvF8'
});
