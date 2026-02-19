/**
 * Вариант 1: прозрачный фон — пиксели фона (светлые #FAFAFA или чёрные) делаем прозрачными.
 * Вариант 2: заливка цветом шапки — передать третьим аргументом "fill".
 * Запуск: node scripts/logo-transparent.mjs <входной.png> <выходной.png> [fill]
 */
import { Jimp } from 'jimp';

const [,, srcPath, outPath, mode] = process.argv;
if (!srcPath || !outPath) {
  console.error('Использование: node scripts/logo-transparent.mjs <входной.png> <выходной.png> [fill]');
  process.exit(1);
}

const image = await Jimp.read(srcPath);

// Фон шапки
const BG_R = 250, BG_G = 250, BG_B = 250;
const BG_MIN = 248; // пиксели с r,g,b >= это считаем фоном (светлый)
const BLACK_MAX = 55;  // пиксели с r,g,b <= это считаем фоном (чёрный)

image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
  const r = image.bitmap.data[idx + 0];
  const g = image.bitmap.data[idx + 1];
  const b = image.bitmap.data[idx + 2];
  const isLightBg = r >= BG_MIN && g >= BG_MIN && b >= BG_MIN;
  const isBlackBg = r <= BLACK_MAX && g <= BLACK_MAX && b <= BLACK_MAX;

  if (mode === 'fill') {
    // Режим заливки: чёрный фон → цвет шапки
    if (isBlackBg) {
      image.bitmap.data[idx + 0] = BG_R;
      image.bitmap.data[idx + 1] = BG_G;
      image.bitmap.data[idx + 2] = BG_B;
      image.bitmap.data[idx + 3] = 255;
    }
  } else {
    // Режим прозрачности: и светлый, и чёрный фон → прозрачные
    if (isLightBg || isBlackBg) {
      image.bitmap.data[idx + 3] = 0;
    }
  }
});

await image.write(outPath);
console.log('Сохранено:', outPath, mode === 'fill' ? '(фон цветом шапки)' : '(прозрачный фон)');
