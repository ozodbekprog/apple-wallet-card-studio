'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const DEFAULTS = {
  passTypeIdentifier: 'pass.com.xoshimov.card',
  teamIdentifier: 'XOSHIMOV',
  organizationName: 'Xoshimov Group',
};

function loadCertificates(dir) {
  const needed = ['pass.pem', 'pass.key', 'wwdr.pem'];
  const signed = needed.every((f) => fs.existsSync(path.join(dir, f)));
  let config = { ...DEFAULTS };
  const configPath = path.join(dir, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
    } catch {
      throw new Error('certs/config.json noto\u2018g\u2018ri JSON');
    }
  }
  return { dir, signed, config };
}

/* ---------- zip (store only) ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, data] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  const count = Object.keys(files).length;
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, eocd]);
}

/* ---------- signing ---------- */

function signManifest(manifest, certs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkpass-'));
  try {
    const manifestPath = path.join(dir, 'manifest.json');
    const sigPath = path.join(dir, 'signature');
    fs.writeFileSync(manifestPath, manifest);
    execFileSync(
      'openssl',
      [
        'smime', '-binary', '-sign',
        '-certfile', path.join(certs.dir, 'wwdr.pem'),
        '-signer', path.join(certs.dir, 'pass.pem'),
        '-inkey', path.join(certs.dir, 'pass.key'),
        '-in', manifestPath,
        '-out', sigPath,
        '-outform', 'DER',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    return fs.readFileSync(sigPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* ---------- pass ---------- */

const DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/;

function image(dataUrl, maxBytes) {
  if (typeof dataUrl !== 'string') throw new Error('Rasm yuborilmadi');
  const match = DATA_URL.exec(dataUrl.trim());
  if (!match) throw new Error('Rasm PNG formatida bo\u2018lishi kerak');
  const buf = Buffer.from(match[1], 'base64');
  if (!buf.length) throw new Error('Rasm bo\u2018sh');
  if (buf.length > maxBytes) throw new Error('Rasm juda katta');
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Rasm PNG emas');
  return buf;
}

function text(value, max) {
  if (value === undefined || value === null) return '';
  const str = String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return str.slice(0, max);
}

function rgb(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(String(hex))) throw new Error('Rang formati #rrggbb');
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function buildPass(payload, certs) {
  if (!payload || typeof payload !== 'object') throw new Error('Ma\u2019lumot yo\u2018q');

  const fields = payload.fields || {};
  const images = payload.images || {};

  const name = text(fields.name, 40) || 'Mening kartam';
  const holder = text(fields.holder, 40);
  const balance = text(fields.balance, 24);
  const extra = text(fields.extra, 48);
  const barcodeMessage = text(fields.barcode, 200) || `card-${Date.now().toString(36)}`;

  const background = rgb(fields.background || '#1c1c1e');
  const foreground = rgb(fields.foreground || '#ffffff');
  const label = rgb(fields.label || '#aeaeb2');

  const storeCard = {
    primaryFields: [
      balance
        ? { key: 'balance', label: 'BALANS', value: balance }
        : { key: 'balance', label: 'KARTA', value: name },
    ],
    backFields: [
      {
        key: 'about',
        label: 'Karta haqida',
        value: `Bu karta Apple Wallet pass \u2014 Apple Pay bank kartasi emas.\nSeriya: ${name}`,
      },
    ],
  };

  if (holder) storeCard.secondaryFields = [{ key: 'holder', label: 'KARTA EGASI', value: holder }];
  if (extra) storeCard.auxiliaryFields = [{ key: 'extra', label: '', value: extra }];

  const pass = {
    formatVersion: 1,
    passTypeIdentifier: certs.config.passTypeIdentifier,
    teamIdentifier: certs.config.teamIdentifier,
    organizationName: certs.config.organizationName,
    serialNumber: `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
    description: name,
    logoText: name,
    backgroundColor: background,
    foregroundColor: foreground,
    labelColor: label,
    storeCard,
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: barcodeMessage,
      messageEncoding: 'iso-8859-1',
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: barcodeMessage,
        messageEncoding: 'iso-8859-1',
        altText: name,
      },
    ],
  };

  const files = {
    'pass.json': Buffer.from(JSON.stringify(pass, null, 2), 'utf8'),
    'icon.png': image(images.icon1, 2 * 1024 * 1024),
    'icon@2x.png': image(images.icon2, 2 * 1024 * 1024),
    'icon@3x.png': image(images.icon3, 2 * 1024 * 1024),
    'logo.png': image(images.logo1, 2 * 1024 * 1024),
    'logo@2x.png': image(images.logo2, 2 * 1024 * 1024),
    'strip.png': image(images.strip1, 4 * 1024 * 1024),
    'strip@2x.png': image(images.strip2, 4 * 1024 * 1024),
    'strip@3x.png': image(images.strip3, 4 * 1024 * 1024),
  };

  const manifest = {};
  for (const [file, data] of Object.entries(files)) {
    manifest[file] = crypto.createHash('sha1').update(data).digest('hex');
  }
  const manifestBuf = Buffer.from(JSON.stringify(manifest), 'utf8');
  files['manifest.json'] = manifestBuf;

  if (certs.signed) {
    files.signature = signManifest(manifestBuf, certs);
  }

  return { zip: zipStore(files), signed: certs.signed, pass };
}

module.exports = { buildPass, loadCertificates };
