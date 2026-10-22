// Gera os arquivos de marca (painel e app) a partir do logotipo original enviado pelo dono do produto.
// Original: apps/admin/public/brand/oss-logo.png (1254x1254, fundo escuro embutido). Para TROCAR a logo: substitua esse arquivo
// (de preferência já corrigido) e rode `node scripts/build-brand-assets.mjs`. Se o logotipo final tiver fundo transparente,
// os recortes ficam transparentes e o painel passa a usá-los direto sobre qualquer fundo.
// Só gera arquivos locais; usa o `sharp` que o painel já tem.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'apps/admin/public/brand/oss-logo.png');
const BG = { r: 4, g: 10, b: 18, alpha: 1 }; // cor de fundo do logotipo atual (usada nos ícones do app)
const out = (...p) => path.join(ROOT, ...p);
mkdirSync(out('apps/admin/public/brand'), { recursive: true });
mkdirSync(out('apps/mobile/assets/images'), { recursive: true });

// Recortes (em pixels do original 1254x1254): o conjunto "OSS + APP + frase" e só "OSS"
const lockup = { left: 110, top: 320, width: 1034, height: 650 };
const wordmark = { left: 110, top: 320, width: 1034, height: 460 };
const letterO = { left: 120, top: 330, width: 560, height: 460 };

await sharp(SRC).extract(lockup).resize({ width: 900 }).png({ compressionLevel: 9 }).toFile(out('apps/admin/public/brand/oss-lockup.png'));
await sharp(SRC).extract(wordmark).resize({ width: 700 }).png({ compressionLevel: 9 }).toFile(out('apps/admin/public/brand/oss-wordmark.png'));

// Ícone do site (favicon do painel): a letra O sobre quadrado escuro
const o = await sharp(SRC).extract(letterO).resize({ width: 220 }).toBuffer();
await sharp({ create: { width: 256, height: 256, channels: 4, background: BG } }).composite([{ input: o, gravity: 'center' }]).png().toFile(out('apps/admin/app/icon.png'));

// App: ícone (logotipo inteiro), splash (conjunto), ícone adaptativo do Android (conjunto menor, no centro) e favicon web
await sharp(SRC).resize(1024, 1024).png().toFile(out('apps/mobile/assets/images/icon.png'));
await sharp(SRC).extract(lockup).resize({ width: 900 }).png().toFile(out('apps/mobile/assets/images/oss-lockup.png'));
const splash = await sharp(SRC).extract(lockup).resize({ width: 760 }).toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).composite([{ input: splash, gravity: 'center' }]).png().toFile(out('apps/mobile/assets/images/splash-icon.png'));
const fg = await sharp(SRC).extract(wordmark).resize({ width: 620 }).toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).composite([{ input: fg, gravity: 'center' }]).png().toFile(out('apps/mobile/assets/images/android-icon-foreground.png'));
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).png().toFile(out('apps/mobile/assets/images/android-icon-background.png'));
await sharp(out('apps/admin/app/icon.png')).resize(48, 48).png().toFile(out('apps/mobile/assets/images/favicon.png'));
console.log('Arquivos de marca gerados.');
