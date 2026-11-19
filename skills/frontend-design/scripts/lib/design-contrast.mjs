// Contrast fallback when axe-core is unavailable: the text/surface pair from DESIGN.md.
import fs from 'node:fs';
import path from 'node:path';
import { parseDesignMd, textSurfaceContrast, DesignFormatError } from '../../../design-system/scripts/validate-design-md.mjs';
import { AA_NORMAL_TEXT, formatRatio } from '../contrast.mjs';

export function designContrast(cwd) {
  const file = path.join(cwd, 'DESIGN.md');
  if (!fs.existsSync(file)) return null;
  try {
    const { tokens } = parseDesignMd(fs.readFileSync(file, 'utf8'));
    const pair = textSurfaceContrast(tokens.colors || {});
    if (!pair) return null;
    return { ...pair, ratio: Number(formatRatio(pair.ratio)), passes: pair.ratio >= AA_NORMAL_TEXT, source: 'DESIGN.md' };
  } catch (error) {
    if (error instanceof DesignFormatError) return { error: `DESIGN.md ${error.message}` };
    throw error;
  }
}
