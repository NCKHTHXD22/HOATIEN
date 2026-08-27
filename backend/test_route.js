const express = require('express');
const app = express();
app.get('/zalo_verifier*.html', (req, res) => res.send('MATCH'));
app.get('*', (req, res) => res.send('NO MATCH'));

const request = require('supertest');
request(app)
  .get('/zalo_verifierUExa2QR4Dp9Ymf5bj_KVPN7eXsMTdb8pDJWm.html')
  .expect(200)
  .end((err, res) => {
    console.log(res.text);
    process.exit(0);
  });
