/**
 * Заменяет чёрный/тёмный фон логотипа на цвет шапки (#FAFAFA).
 * Запуск: node scripts/logo-transparent.mjs <входной.png> <выходной.png>
 */
import { Jimp } from 'jimp';

const [,, srcPath, outPath] = process.argv;
if (!srcPath || !outPath) {
  console.error('Использование: node scripts/logo-transparent.mjs <входной.png> <выходной.png>');
  process.exit(1);
}

const BLACK_THRESHOLD = 55; // пиксели с r,g,b <= это значение считаем фоном
// Цвет фона шапки (--bg-page в index.html)
const BG_R = 250, BG_G = 250, BG_B = 250;

const image = await Jimp.read(srcPath);

image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
  const r = image.bitmap.data[idx + 0];
  const g = image.bitmap.data[idx + 1];
  const b = image.bitmap.data[idx + 2];
  if (r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD) {
    image.bitmap.data[idx + 0] = BG_R;
    image.bitmap.data[idx + 1] = BG_G;
    image.bitmap.data[idx + 2] = BG_B;
    image.bitmap.data[idx + 3] = 255;
  }
});

await image.write(outPath);
console.log('Сохранено:', outPath);
