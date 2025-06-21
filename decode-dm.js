#!/usr/bin/env node
// Usage: node decode-dm.js <image-file>

import fs from 'node:fs';
import sharp from 'sharp';
import { readBarcodes } from 'zxing-wasm';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: decode-dm.js <image>');
  process.exit(1);
}

try {
  /* 1. Sharp pre-processing with PNG buffer (most reliable method) ---------- */
  const pngBuffer = await sharp(file)
    .median(3)             // denoise a bit
    .linear(1.6, -30)      // contrast stretch (gain, bias)
    .sharpen()             // unsharp mask
    .png()
    .toBuffer();

  const results = await readBarcodes(pngBuffer, {
    formats: ['DataMatrix'],
    tryHarder: true,
    maxNumberOfSymbols: 10
  });

  if (results && results.length > 0 && results[0].isValid) {
    console.log(results[0].text);
    process.exit(0);
  }

  /* 2. Try with enhanced preprocessing for difficult cases ----------------- */
  const enhancedBuffer = await sharp(file)
    .median(5)             // stronger noise reduction
    .linear(2.0, -50)      // more aggressive contrast
    .sharpen({ sigma: 1.5 }) // stronger sharpening
    .threshold(128)        // binary threshold
    .png()
    .toBuffer();

  const enhancedResults = await readBarcodes(enhancedBuffer, {
    formats: ['DataMatrix'],
    tryHarder: true,
    maxNumberOfSymbols: 10
  });

  if (enhancedResults && enhancedResults.length > 0 && enhancedResults[0].isValid) {
    console.log(enhancedResults[0].text);
    process.exit(0);
  }

  /* 3. Try with different rotations ---------------------------------------- */
  for (const angle of [90, 180, 270]) {
    const rotatedBuffer = await sharp(file)
      .median(3)
      .linear(1.6, -30)
      .sharpen()
      .rotate(angle)
      .png()
      .toBuffer();

    const rotatedResults = await readBarcodes(rotatedBuffer, {
      formats: ['DataMatrix'],
      tryHarder: true,
      maxNumberOfSymbols: 10
    });

    if (rotatedResults && rotatedResults.length > 0) {
      const validRotated = rotatedResults.filter(r => r.isValid);
      if (validRotated.length > 0) {
        console.log(validRotated[0].text);
        process.exit(0);
      }
    }
  }

  /* 4. Try with original file as fallback --------------------------------- */
  const originalBuffer = await fs.promises.readFile(file);
  const originalResults = await readBarcodes(originalBuffer);

  if (originalResults && originalResults.length > 0) {
    const validResults = originalResults.filter(r => r.isValid);
    if (validResults.length > 0) {
      console.log(validResults[0].text);
      process.exit(0);
    }
  }

  /* 5. No decode successful ------------------------------------------------ */
  console.error('Decode failed');
  process.exit(2);

} catch (error) {
  console.error('Processing error:', error.message);
  process.exit(2);
} 