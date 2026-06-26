const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const buildDir = path.join(__dirname, '..', 'build');
const sourceImage = path.join(__dirname, '..', 'IMG_20260625_215759.png');

const sizes = [16, 32, 48, 64, 128, 256, 512];

async function generateIcons() {
  console.log('从源图片生成图标:', path.basename(sourceImage));
  
  const pngBuffers = {};
  
  for (const size of sizes) {
    const pngPath = path.join(buildDir, `icon-${size}.png`);
    const buffer = await sharp(sourceImage)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    fs.writeFileSync(pngPath, buffer);
    pngBuffers[size] = buffer;
    console.log(`  ✓ ${size}x${size}`);
  }
  
  console.log('\n生成 ICO 文件...');
  
  const icoPath = path.join(buildDir, 'icon.ico');
  
  const iconSizes = [16, 32, 48, 64, 128, 256];
  const entries = [];
  let dataOffset = 6 + (16 * iconSizes.length);
  
  for (const size of iconSizes) {
    const pngData = pngBuffers[size];
    entries.push({
      width: size === 256 ? 0 : size,
      height: size === 256 ? 0 : size,
      colors: 0,
      planes: 1,
      bitCount: 32,
      size: pngData.length,
      offset: dataOffset,
      data: pngData
    });
    dataOffset += pngData.length;
  }
  
  const totalSize = dataOffset;
  const icoBuffer = Buffer.alloc(totalSize);
  
  icoBuffer.writeUInt16LE(0, 0);
  icoBuffer.writeUInt16LE(1, 2);
  icoBuffer.writeUInt16LE(iconSizes.length, 4);
  
  let offset = 6;
  for (const entry of entries) {
    icoBuffer.writeUInt8(entry.width, offset);
    icoBuffer.writeUInt8(entry.height, offset + 1);
    icoBuffer.writeUInt8(entry.colors, offset + 2);
    icoBuffer.writeUInt8(0, offset + 3);
    icoBuffer.writeUInt16LE(entry.planes, offset + 4);
    icoBuffer.writeUInt16LE(entry.bitCount, offset + 6);
    icoBuffer.writeUInt32LE(entry.size, offset + 8);
    icoBuffer.writeUInt32LE(entry.offset, offset + 12);
    offset += 16;
  }
  
  for (const entry of entries) {
    entry.data.copy(icoBuffer, entry.offset);
  }
  
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('  ✓ icon.ico 生成成功');
  
  fs.copyFileSync(
    path.join(buildDir, 'icon-256.png'),
    path.join(buildDir, 'icon.png')
  );
  console.log('  ✓ icon.png (256px) 创建成功');
  
  fs.copyFileSync(
    path.join(buildDir, 'icon-256.png'),
    path.join(__dirname, '..', 'public', 'favicon.png')
  );
  console.log('  ✓ public/favicon.png 创建成功');
  
  console.log('\n所有图标生成完成！');
}

generateIcons().catch(console.error);
