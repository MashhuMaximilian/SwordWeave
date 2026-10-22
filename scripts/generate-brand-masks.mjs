// Size CSS alpha masks for their actual display sizes; keep the original art.
// Uses Next's existing sharp dependency. No runtime image transform is needed.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.resolve('next/package.json'))('sharp');
const root = new URL('../', import.meta.url);
const check = process.argv.includes('--check');
const directory = new URL('public/brand/masks/', root);
if (!check) await fs.mkdir(directory, { recursive: true });
for (const [name, widths] of [['light', [36, 72, 108, 144]], ['mono', [192, 384, 576, 768]]]) {
  const source = await fs.readFile(new URL(`public/logo-${name}-mask.png`, root));
  for (const width of widths) {
    // Lossless PNG encoding retains the resampled alpha; no palette quantization.
    const bytes = await sharp(source).resize({ width, kernel: 'lanczos3' })
      .png({ compressionLevel: 9 }).toBuffer();
    const target = new URL(`logo-${name}-${width}.png`, directory);
    if (check) {
      const existing = await fs.readFile(target);
      if (!existing.equals(bytes)) throw new Error(`Regenerate ${target.pathname}`);
    } else await fs.writeFile(target, bytes);
    console.log(`${check ? 'Checked' : 'Generated'} ${name} ${width}px: ${bytes.length} bytes`);
  }
}
