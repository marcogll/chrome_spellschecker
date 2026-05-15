// icon_manager.js — Genera el icono diario con paleta Catppuccin.

const BOOKMARK_PATH = `M 122.48986,483.4938 C 113.6823,482.02073 99.885599,476.84974 90.944194,471.67055 86.770843,469.25318 78.639598,462.52703 72.874768,456.72353 64.253379,448.04435 61.373418,444.10262 56.646846,434.5128 45.787144,412.47943 46.545121,424.86087 46.541697,269.44713 46.539242,156.39194 46.84424,130.46985 48.260258,123.4039 57.361414,77.988862 89.320144,43.271992 133.71038,30.579179 c 9.44568,-2.70088 11.76867,-2.811443 67.69065,-3.221726 54.80197,-0.402061 57.9721,-0.30609 59.07982,1.788759 0.76594,1.448504 0.58035,6.87979 -0.53696,15.71343 -2.50342,19.792687 -3.54669,77.126748 -1.82,100.021208 1.39505,18.49729 5.54604,50.7305 7.03162,54.60184 1.02948,2.68279 5.00841,4.5824 7.76545,3.70735 1.29465,-0.4109 12.15301,-15.86331 24.62586,-35.04473 12.27059,-18.87036 22.94327,-34.30872 23.71709,-34.30747 0.77381,0.001 11.27596,15.20461 23.33811,33.78522 12.06217,18.58061 22.99024,34.34971 24.28464,35.04244 3.34638,1.79092 6.69018,0.35993 8.22393,-3.51947 1.4174,-3.58512 3.9679,-20.53485 6.50351,-43.2199 2.37237,-21.22456 2.01919,-83.131646 -0.60815,-106.603186 -1.64372,-14.68407 -1.7862,-19.245319 -0.6442,-20.621354 1.21141,-1.459659 6.07155,-1.702213 27.95503,-1.395166 25.15738,0.352982 26.79233,0.521104 32.53034,3.345187 8.06563,3.969664 14.9762,11.10417 18.93547,19.54909 l 3.24971,6.931481 0.35111,200.656038 c 0.24934,142.49882 -0.039,202.2567 -0.99479,206.17868 -1.98638,8.15072 -6.69796,14.19081 -13.84945,17.75455 l -6.23849,3.10877 -157.76799,-0.14347 C 199.7603,484.60785 125.94101,484.07102 122.48986,483.4938 Z M 426.3738,393.38088 v -52.1772 l -151.25906,0.32572 -151.25907,0.32572 -8.12331,4.07797 c -15.854566,7.9591 -26.901129,23.01314 -29.578212,40.30862 -3.2002,20.67502 8.630455,43.54594 27.577502,53.31262 11.58576,5.97212 7.8182,5.83694 165.06485,5.92299 l 147.5773,0.0808 z`;

const CATPPUCCIN_ACCENTS = [
  '#dc8a78', // rosewater
  '#dd7878', // flamingo
  '#ea76cb', // pink
  '#8839ef', // mauve
  '#d20f39', // red
  '#e64553', // maroon
  '#fe640b', // peach
  '#df8e1d', // yellow
  '#40a02b', // green
  '#179299', // teal
  '#04a5e5', // sky
  '#209fb5', // sapphire
  '#1e66f5', // blue
  '#7287fd', // lavender
];

const CATPPUCCIN_BASE = '#eff1f5';
const CATPPUCCIN_CRUST = '#dce0e8';
const ICON_SIZES = [16, 48, 128];

export async function applyDailyIcon() {
  if (!chrome?.action?.setIcon || !self.OffscreenCanvas || !self.Path2D) return;

  try {
    const color = getDailyCatppuccinColor();
    const imageData = {};

    for (const size of ICON_SIZES) {
      imageData[size] = renderIcon(size, color);
    }

    await chrome.action.setIcon({ imageData });
  } catch (error) {
    console.warn('[SpellCheck] No se pudo generar el icono diario:', error);
  }
}

function getDailyCatppuccinColor(date = new Date()) {
  const day = Math.floor(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ) / 86400000);
  return CATPPUCCIN_ACCENTS[day % CATPPUCCIN_ACCENTS.length];
}

function renderIcon(size, accent) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const scale = size / 512;

  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = CATPPUCCIN_CRUST;
  ctx.beginPath();
  roundedRect(ctx, 0, 0, size, size, Math.max(3, size * 0.18));
  ctx.fill();

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(0, -1);

  ctx.shadowColor = 'rgba(76, 79, 105, 0.20)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 10;

  ctx.fillStyle = accent;
  ctx.fill(new Path2D(BOOKMARK_PATH));

  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 0.20;
  ctx.fillStyle = CATPPUCCIN_BASE;
  ctx.fill(new Path2D(BOOKMARK_PATH));

  ctx.restore();

  return ctx.getImageData(0, 0, size, size);
}

function roundedRect(ctx, x, y, width, height, radius) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}
