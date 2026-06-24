/**
 * Checagem de contraste pixel-perfect via screenshot.
 *
 * Estrat\u00e9gia (WCAG 1.4.3 \u2014 m\u00ednimo 4.5:1 para texto normal, 3:1 para grande):
 *
 * 1. Captura screenshot da tela (driver.takeScreenshot \u2192 base64 PNG).
 * 2. Decodifica com `pngjs` (import din\u00e2mico \u2014 se a lib n\u00e3o estiver instalada,
 *    retorna apenas um finding `info` pedindo `npm install`).
 * 3. Para cada label da matriz:
 *    - localiza o elemento e obt\u00e9m bounding rect
 *    - amostra pixels INTERIORES como cor de "primeiro plano" (texto/\u00edcone)
 *    - amostra pixels do CONTORNO como cor de "fundo"
 *    - clusteriza por dist\u00e2ncia para reduzir ru\u00eddo (anti-aliasing)
 *    - calcula raz\u00e3o de contraste (f\u00f3rmula WCAG)
 * 4. Compara contra threshold (4.5:1 padr\u00e3o, configur\u00e1vel por matriz).
 *
 * Limita\u00e7\u00f5es conhecidas:
 * - Coordenadas Appium em Android s\u00e3o em px f\u00edsicos, ent\u00e3o casam com o PNG.
 * - iOS pode reportar coords em pontos \u2014 multiplicamos por scale via deviceInfo.
 * - Em telas Flutter com fundo gradiente, o "fundo amostrado" \u00e9 m\u00e9dia do contorno,
 *   o que cobre o pior caso vis\u00edvel \u2014 mas pode marcar falsos positivos em
 *   \u00edcones decorativos sobre imagem; nesses casos, exclua via `contrastTargets`.
 */
import type { A11yFinding } from './types';

/** Aceit\u00e1vel para texto normal (WCAG 1.4.3 AA) */
const DEFAULT_RATIO = 4.5;

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PngLike {
  width: number;
  height: number;
  /** RGBA cont\u00edguo */
  data: Buffer;
}

type PngStatic = {
  PNG: { sync: { read(buffer: Buffer): PngLike } };
};

let pngModule: PngStatic | null | undefined;

async function loadPng(): Promise<PngStatic | null> {
  if (pngModule !== undefined) return pngModule;
  try {
    // pngjs é uma devDependency opcional — pode ainda não estar instalada
    // em ambientes recém-clonados. Ts-ignore evita erro de typecheck.
    // @ts-expect-error optional runtime dep
    pngModule = (await import('pngjs')) as unknown as PngStatic;
  } catch {
    pngModule = null;
  }
  return pngModule;
}

/** Luminância relativa WCAG */
function luminance({ r, g, b }: RGB): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function getPixel(png: PngLike, x: number, y: number): RGB | null {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return null;
  const idx = (png.width * y + x) << 2;
  return { r: png.data[idx], g: png.data[idx + 1], b: png.data[idx + 2] };
}

/** Aglomera pixels pela cor mais frequente em buckets de 16 níveis por canal */
function dominantColor(pixels: RGB[]): RGB | null {
  if (pixels.length === 0) return null;
  const buckets = new Map<string, { rgb: RGB; count: number }>();
  for (const p of pixels) {
    const key = `${p.r >> 4}-${p.g >> 4}-${p.b >> 4}`;
    const slot = buckets.get(key);
    if (slot) {
      slot.count += 1;
    } else {
      buckets.set(key, { rgb: p, count: 1 });
    }
  }
  let best: { rgb: RGB; count: number } | null = null;
  for (const slot of buckets.values()) {
    if (!best || slot.count > best.count) best = slot;
  }
  return best?.rgb ?? null;
}

function sampleBorder(png: PngLike, rect: Rect, step = 2): RGB[] {
  const samples: RGB[] = [];
  const right = rect.x + rect.width - 1;
  const bottom = rect.y + rect.height - 1;
  for (let x = rect.x; x <= right; x += step) {
    const top = getPixel(png, x, rect.y);
    const bot = getPixel(png, x, bottom);
    if (top) samples.push(top);
    if (bot) samples.push(bot);
  }
  for (let y = rect.y; y <= bottom; y += step) {
    const left = getPixel(png, rect.x, y);
    const rgt = getPixel(png, right, y);
    if (left) samples.push(left);
    if (rgt) samples.push(rgt);
  }
  return samples;
}

function sampleInterior(png: PngLike, rect: Rect, step = 2): RGB[] {
  const samples: RGB[] = [];
  // Margem interna de 15% para evitar borda/anti-aliasing
  const padX = Math.max(1, Math.floor(rect.width * 0.15));
  const padY = Math.max(1, Math.floor(rect.height * 0.15));
  const x0 = rect.x + padX;
  const y0 = rect.y + padY;
  const x1 = rect.x + rect.width - padX;
  const y1 = rect.y + rect.height - padY;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const p = getPixel(png, x, y);
      if (p) samples.push(p);
    }
  }
  return samples;
}

/** Encontra a cor "diferente" do fundo \u2014 candidata a texto/\u00edcone */
function pickForeground(interior: RGB[], background: RGB): RGB | null {
  if (interior.length === 0) return null;
  let best: RGB | null = null;
  let maxDelta = -1;
  // Agrupa em buckets para reduzir ru\u00eddo
  const grouped = new Map<string, { rgb: RGB; count: number }>();
  for (const p of interior) {
    const key = `${p.r >> 4}-${p.g >> 4}-${p.b >> 4}`;
    const slot = grouped.get(key);
    if (slot) slot.count += 1;
    else grouped.set(key, { rgb: p, count: 1 });
  }
  for (const slot of grouped.values()) {
    if (slot.count < 4) continue; // ignora ru\u00eddo isolado
    const delta =
      Math.abs(slot.rgb.r - background.r) + Math.abs(slot.rgb.g - background.g) + Math.abs(slot.rgb.b - background.b);
    if (delta > maxDelta) {
      maxDelta = delta;
      best = slot.rgb;
    }
  }
  return best;
}

async function findElementRect(label: string): Promise<Rect | null> {
  // Reaproveita selectors do helper principal
  const { byA11y, byDescContains, byText } = await import('../selectors');
  for (const selector of [byA11y(label), byDescContains(label), byText(label)]) {
    try {
      const element = await $(selector);
      if (!(await element.isExisting())) continue;
      const loc = await element.getLocation();
      const size = await element.getSize();
      if (size.width === 0 || size.height === 0) continue;
      return {
        x: Math.round(loc.x),
        y: Math.round(loc.y),
        width: Math.round(size.width),
        height: Math.round(size.height),
      };
    } catch {
      // tenta pr\u00f3ximo seletor
    }
  }
  return null;
}

async function captureScreen(): Promise<Buffer | null> {
  try {
    const base64 = await driver.takeScreenshot();
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
}

export interface ContrastOptions {
  /** Threshold de contraste (default 4.5 \u2014 WCAG AA texto normal). */
  threshold?: number;
  /** Labels a serem checados. Default: usa expectedLabels da matriz. */
  targets?: string[];
}

/**
 * RULE: contrast (pixel-perfect)
 *
 * Retorna findings com a raz\u00e3o calculada para cada label. Severity:
 * - `error` quando ratio < threshold/2 (cr\u00edtico, ilegível)
 * - `warning` quando ratio < threshold
 * - `info` quando passa (registrado nos detalhes)
 */
export async function checkContrastPixelPerfect(
  expectedLabels: string[],
  options: ContrastOptions = {},
): Promise<A11yFinding[]> {
  const findings: A11yFinding[] = [];
  const png = await loadPng();
  if (!png) {
    return [
      {
        rule: 'contrast',
        severity: 'info',
        message:
          'Checagem pixel-perfect indispon\u00edvel \u2014 instale `pngjs` (`npm install --save-dev pngjs @types/pngjs`).',
      },
    ];
  }

  const buffer = await captureScreen();
  if (!buffer) {
    return [
      {
        rule: 'contrast',
        severity: 'info',
        message: 'N\u00e3o foi poss\u00edvel capturar screenshot para an\u00e1lise de contraste.',
      },
    ];
  }

  let img: PngLike;
  try {
    img = png.PNG.sync.read(buffer);
  } catch {
    return [
      {
        rule: 'contrast',
        severity: 'info',
        message: 'Screenshot n\u00e3o p\u00f4de ser decodificado como PNG.',
      },
    ];
  }

  const threshold = options.threshold ?? DEFAULT_RATIO;
  const targets = options.targets ?? expectedLabels;

  // Em iOS, coords vem em pontos \u2014 PNG em pixels. Multiplica pelo scale.
  let scale = 1;
  if (!driver.isAndroid) {
    try {
      const window = await driver.getWindowSize();
      if (window.width > 0) scale = img.width / window.width;
    } catch {
      scale = 1;
    }
  }

  for (const label of targets) {
    const rect = await findElementRect(label);
    if (!rect) continue;

    const scaled: Rect = {
      x: Math.round(rect.x * scale),
      y: Math.round(rect.y * scale),
      width: Math.round(rect.width * scale),
      height: Math.round(rect.height * scale),
    };

    const border = sampleBorder(img, scaled);
    const interior = sampleInterior(img, scaled);
    const bg = dominantColor(border);
    if (!bg) continue;
    const fg = pickForeground(interior, bg);
    if (!fg) continue;

    const ratio = contrastRatio(fg, bg);
    const ratioFmt = ratio.toFixed(2);

    if (ratio < threshold / 2) {
      findings.push({
        rule: 'contrast',
        severity: 'error',
        message: `Contraste cr\u00edtico em "${label}": ${ratioFmt}:1 (m\u00ednimo ${threshold}:1)`,
        element: label,
        details: { ratio, threshold, fg, bg },
      });
    } else if (ratio < threshold) {
      findings.push({
        rule: 'contrast',
        severity: 'warning',
        message: `Contraste abaixo do recomendado em "${label}": ${ratioFmt}:1 (m\u00ednimo ${threshold}:1)`,
        element: label,
        details: { ratio, threshold, fg, bg },
      });
    } else {
      findings.push({
        rule: 'contrast',
        severity: 'info',
        message: `Contraste OK em "${label}": ${ratioFmt}:1`,
        element: label,
        details: { ratio, threshold },
      });
    }
  }

  return findings;
}
