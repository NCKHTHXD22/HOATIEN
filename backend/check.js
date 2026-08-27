const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `
cat << 'EOF' > /var/www/hoatien/backend/checkVillages.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.village.findMany().then(v => {
  console.log(JSON.stringify(v, null, 2));
  process.exit(0);
});
EOF
cd /var/www/hoatien/backend && node checkVillages.js
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
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
