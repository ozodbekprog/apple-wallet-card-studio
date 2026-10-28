'use strict';

const $ = (id) => document.getElementById(id);

const state = {
  image: null,
  imageUrl: null,
  logo: null,
  logoUrl: null,
  background: '#1c1c1e',
  foreground: '#ffffff',
  label: '#aeaeb2',
  signed: false,
};

const PRESETS = [
  { name: 'Midnight', bg: '#1c1c1e', fg: '#ffffff', label: '#aeaeb2' },
  { name: 'Graphite', bg: '#2c2c2e', fg: '#f2f2f7', label: '#c7c7cc' },
  { name: 'Gold', bg: '#a98644', fg: '#1c1405', label: '#40300f' },
  { name: 'Ocean', bg: '#0f3d5c', fg: '#eef8ff', label: '#a9c8db' },
  { name: 'Forest', bg: '#123c2c', fg: '#eafff4', label: '#9cc7b1' },
  { name: 'Burgundy', bg: '#4a1220', fg: '#ffe9ee', label: '#d9a6b2' },
  { name: 'Paper', bg: '#f2f2f7', fg: '#1c1c1e', label: '#6e6e73' },
];

const els = {
  pass: $('pass'),
  strip: $('strip'),
  stripHint: $('stripHint'),
  passLogo: $('passLogo'),
  pName: $('pName'),
  pBalance: $('pBalance'),
  pHolder: $('pHolder'),
  pExtra: $('pExtra'),
  fName: $('fName'),
  fHolder: $('fHolder'),
  fBalance: $('fBalance'),
  fExtra: $('fExtra'),
  fBarcode: $('fBarcode'),
  imageInput: $('imageInput'),
  logoInput: $('logoInput'),
  drop: $('drop'),
  dropText: $('dropText'),
  swatches: $('swatches'),
  makeBtn: $('makeBtn'),
  error: $('error'),
  toast: $('toast'),
  certBadge: $('certBadge'),
  certText: $('certText'),
  signHint: $('signHint'),
  lanBox: $('lanBox'),
  lanUrl: $('lanUrl'),
  copyBtn: $('copyBtn'),
};

/* ---------- helpers ---------- */

function toast(message, bad = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle('bad', bad);
  els.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { els.toast.hidden = true; }, 3600);
}

function showError(message) {
  if (!message) {
    els.error.hidden = true;
    return;
  }
  els.error.textContent = message;
  els.error.hidden = false;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = clampByte(((n >> 16) & 255) * factor);
  const g = clampByte(((n >> 8) & 255) * factor);
  const b = clampByte((n & 255) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function cover(img, width, height) {
  const canvas = canvasOf(width, height);
  const ctx = canvas.getContext('2d');
  const scale = Math.max(width / img.width, height / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
  return canvas.toDataURL('image/png');
}

function contain(img, width, height) {
  const canvas = canvasOf(width, height);
  const ctx = canvas.getContext('2d');
  const scale = Math.min(width / img.width, height / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
  return canvas.toDataURL('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fallbackStrip(width, height) {
  const canvas = canvasOf(width, height);
  const ctx = canvas.getContext('2d');
  const base = state.background;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, shade(base, 1.55));
  gradient.addColorStop(0.55, shade(base, 1.15));
  gradient.addColorStop(1, shade(base, 0.65));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.78, height * 0.1, 0, width * 0.78, height * 0.1, width * 0.55);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/png');
}

function fallbackIcon(size) {
  const canvas = canvasOf(size, size);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, shade(state.background, 1.7));
  gradient.addColorStop(1, shade(state.background, 0.9));
  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, size, size, size * 0.22);
  ctx.fill();

  const initial = (els.fName.value.trim() || 'K').charAt(0).toUpperCase();
  ctx.fillStyle = state.foreground;
  ctx.font = `600 ${Math.round(size * 0.52)}px -apple-system, "SF Pro Display", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, size / 2, size / 2 + size * 0.02);
  return canvas.toDataURL('image/png');
}

function blankLogo(width, height) {
  const canvas = canvasOf(width, height);
  return canvas.toDataURL('image/png');
}

function usableLogo() {
  return state.logo ? contain(state.logo, 320, 100) : blankLogo(320, 100);
}

function buildImages() {
  const strip = state.image
    ? [
        cover(state.image, 375, 123),
        cover(state.image, 750, 246),
        cover(state.image, 1125, 369),
      ]
    : [
        fallbackStrip(375, 123),
        fallbackStrip(750, 246),
        fallbackStrip(1125, 369),
      ];

  const icon = state.image
    ? [cover(state.image, 29, 29), cover(state.image, 58, 58), cover(state.image, 87, 87)]
    : [fallbackIcon(29), fallbackIcon(58), fallbackIcon(87)];

  return {
    strip1: strip[0],
    strip2: strip[1],
    strip3: strip[2],
    icon1: icon[0],
    icon2: icon[1],
    icon3: icon[2],
    logo1: state.logo ? contain(state.logo, 160, 50) : blankLogo(160, 50),
    logo2: usableLogo(),
  };
}

/* ---------- preview ---------- */

function render() {
  els.pass.style.setProperty('--pass-bg', state.background);
  els.pass.style.setProperty('--pass-fg', state.foreground);
  els.pass.style.setProperty('--pass-label', state.label);
  els.pass.style.background = state.background;
  els.pass.style.color = state.foreground;
  els.pass.style.setProperty('--pass-label', state.label);

  const name = els.fName.value.trim() || 'Mening kartam';
  els.pName.textContent = name;
  els.pName.hidden = Boolean(state.logo);

  if (state.logoUrl) {
    els.passLogo.src = state.logoUrl;
    els.passLogo.hidden = false;
  } else {
    els.passLogo.hidden = true;
    els.passLogo.removeAttribute('src');
  }

  els.pBalance.textContent = els.fBalance.value.trim() || '0 so‘m';
  els.pHolder.textContent = els.fHolder.value.trim() || 'ISM FAMILIYA';
  els.pExtra.textContent = els.fExtra.value.trim();

  if (state.imageUrl) {
    els.strip.style.background = `url("${state.imageUrl}") center / cover no-repeat #26262a`;
    els.strip.classList.add('has-image');
  } else {
    els.strip.style.background = `linear-gradient(135deg, ${shade(state.background, 1.65)}, ${shade(state.background, 0.8)})`;
    els.strip.classList.remove('has-image');
    els.stripHint.textContent = 'Karta rasmini yuklang';
  }

  for (const swatch of els.swatches.children) {
    swatch.setAttribute('aria-checked', String(swatch.dataset.bg === state.background));
  }
}

function applyPreset(preset) {
  state.background = preset.bg;
  state.foreground = preset.fg;
  state.label = preset.label;
  render();
}

/* ---------- files ---------- */

function loadImageFile(file, onDone) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('Faqat rasm fayli kerak', true);
    return;
  }
  if (file.size > 14 * 1024 * 1024) {
    toast('Rasm 14 MB dan kichik bo‘lsin', true);
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => onDone(img, url);
  img.onerror = () => {
    URL.revokeObjectURL(url);
    toast('Rasmni o‘qib bo‘lmadi', true);
  };
  img.src = url;
}

els.drop.addEventListener('click', () => els.imageInput.click());

els.drop.addEventListener('dragover', (event) => {
  event.preventDefault();
  els.drop.classList.add('over');
});

els.drop.addEventListener('dragleave', () => els.drop.classList.remove('over'));

els.drop.addEventListener('drop', (event) => {
  event.preventDefault();
  els.drop.classList.remove('over');
  loadImageFile(event.dataTransfer.files[0], (img, url) => {
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.image = img;
    state.imageUrl = url;
    els.dropText.textContent = 'Rasm tanlandi — almashtirish uchun bosing';
    render();
  });
});

els.imageInput.addEventListener('change', () => {
  loadImageFile(els.imageInput.files[0], (img, url) => {
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.image = img;
    state.imageUrl = url;
    els.dropText.textContent = 'Rasm tanlandi — almashtirish uchun bosing';
    render();
  });
});

els.logoInput.addEventListener('change', () => {
  loadImageFile(els.logoInput.files[0], (img, url) => {
    if (state.logoUrl) URL.revokeObjectURL(state.logoUrl);
    state.logo = img;
    state.logoUrl = url;
    els.logoInput.parentElement.classList.add('set');
    els.logoInput.parentElement.querySelector('span').textContent = 'Logo tanlandi';
    render();
  });
});

$('clearImage').addEventListener('click', () => {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.image = null;
  state.imageUrl = null;
  els.imageInput.value = '';
  els.dropText.textContent = 'Rasm tanlash yoki sudrab tashlash';
  render();
});

/* ---------- form ---------- */

for (const input of [els.fName, els.fHolder, els.fBalance, els.fExtra, els.fBarcode]) {
  input.addEventListener('input', render);
}

for (const preset of PRESETS) {
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'swatch';
  swatch.dataset.bg = preset.bg;
  swatch.style.background = `linear-gradient(145deg, ${shade(preset.bg, 1.5)}, ${preset.bg})`;
  swatch.title = preset.name;
  swatch.setAttribute('role', 'radio');
  swatch.setAttribute('aria-label', preset.name);
  swatch.addEventListener('click', () => applyPreset(preset));
  els.swatches.appendChild(swatch);
}

/* ---------- download ---------- */

els.makeBtn.addEventListener('click', async () => {
  showError('');
  const name = els.fName.value.trim();
  if (!name) {
    showError('Karta nomini kiriting.');
    els.fName.focus();
    return;
  }

  els.makeBtn.disabled = true;
  try {
    const payload = {
      fields: {
        name,
        holder: els.fHolder.value,
        balance: els.fBalance.value,
        extra: els.fExtra.value,
        barcode: els.fBarcode.value,
        background: state.background,
        foreground: state.foreground,
        label: state.label,
      },
      images: buildImages(),
    };

    const response = await fetch('/api/pass', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || `Server xatosi (${response.status})`);
    }

    const signed = response.headers.get('x-pass-signed') === '1';
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = signed ? 'karta.pkpass' : 'karta-imzosiz.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);

    toast(signed ? 'Tayyor: faylni ochib, Wallet’ga qo‘shing' : 'Imzosiz ZIP yuklandi — sertifikat kerak', !signed);
  } catch (err) {
    showError(err.message || 'Karta yaratilmadi');
  } finally {
    els.makeBtn.disabled = false;
  }
});

els.copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(els.lanUrl.textContent.trim());
    toast('Manzil nusxalandi');
  } catch {
    toast('Nusxalab bo‘lmadi', true);
  }
});

/* ---------- boot ---------- */

async function boot() {
  render();
  try {
    const status = await fetch('/api/status').then((r) => r.json());
    state.signed = status.signed;
    els.certBadge.classList.add(status.signed ? 'ok' : 'warn');
    els.certText.textContent = status.signed ? 'sertifikat bor' : 'imzosiz rejim';
    els.signHint.textContent = status.signed
      ? `Imzolangan .pkpass — ${status.passTypeIdentifier}`
      : 'Sertifikat yo‘q: hozir .pkpass imzosiz ZIP bo‘ladi. certs/README.md ga qarang.';

    const lan = (status.urls || []).find((u) => !u.includes('localhost'));
    if (lan) {
      els.lanUrl.textContent = lan;
      els.lanBox.hidden = false;
    }
  } catch {
    els.certBadge.classList.add('err');
    els.certText.textContent = 'server javob bermadi';
  }
}

boot();
