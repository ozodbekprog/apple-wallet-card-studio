#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildPass, loadCertificates } = require('./lib/pkpass');

const PORT = Number(process.env.PORT || 4173);
const LIMIT = 24 * 1024 * 1024;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const certs = loadCertificates(path.join(ROOT, 'certs'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function lanUrls() {
  const urls = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) urls.push(`http://${net.address}:${PORT}`);
    }
  }
  return urls.length ? urls : [`http://localhost:${PORT}`];
}

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > LIMIT) {
        reject(new Error('So\u2018rov juda katta'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) return json(res, 403, { error: 'Taqiqlangan' });
  fs.readFile(file, (err, data) => {
    if (err) return json(res, 404, { error: 'Topilmadi' });
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'content-length': data.length,
      'cache-control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'GET' && url.pathname === '/api/status') {
      return json(res, 200, {
        signed: certs.signed,
        passTypeIdentifier: certs.config.passTypeIdentifier,
        organizationName: certs.config.organizationName,
        urls: lanUrls(),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/pass') {
      const body = await readBody(req);
      const payload = JSON.parse(body.toString('utf8'));
      const result = buildPass(payload, certs);
      const filename = result.signed ? 'karta.pkpass' : 'karta-imzosiz.zip';
      res.writeHead(200, {
        'content-type': result.signed ? 'application/vnd.apple.pkpass' : 'application/zip',
        'content-length': result.zip.length,
        'content-disposition': `attachment; filename="${filename}"`,
        'x-pass-signed': result.signed ? '1' : '0',
        'cache-control': 'no-store',
      });
      return res.end(result.zip);
    }

    if (req.method === 'GET') return serveStatic(res, url.pathname);
    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return json(res, 400, { error: err.message || 'Xatolik' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Wallet Card Studio: http://localhost:${PORT}`);
  for (const u of lanUrls()) console.log(`iPhone (bir Wi-Fi): ${u}`);
  console.log(`Imzolash: ${certs.signed ? 'yoqilgan' : "o'chirilgan (certs/README.md ga qarang)"}`);
});
