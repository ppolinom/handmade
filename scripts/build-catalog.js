const fs = require('fs');
const path = require('path');

const productsDir = path.join(__dirname, '..', 'products');
const dataDir = path.join(__dirname, '..', 'data');
const outputFile = path.join(dataDir, 'catalog.json');

if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif)$/i;

const folders = fs.readdirSync(productsDir).filter(f =>
  fs.statSync(path.join(productsDir, f)).isDirectory()
);

const products = [];

for (const folder of folders) {
  const productJsonPath = path.join(productsDir, folder, 'product.json');
  if (!fs.existsSync(productJsonPath)) {
    console.warn(`Skipping ${folder}: no product.json`);
    continue;
  }

  const product = JSON.parse(fs.readFileSync(productJsonPath, 'utf8'));

  const imagesDir = path.join(productsDir, folder, 'images');
  let images = [];
  if (fs.existsSync(imagesDir)) {
    const all = fs.readdirSync(imagesDir).filter(f => IMAGE_EXTENSIONS.test(f));
    if (Array.isArray(product.imageOrder)) {
      const ordered = product.imageOrder.filter(f => all.includes(f));
      images = [...ordered, ...all.filter(f => !ordered.includes(f)).sort()];
    } else {
      images = all.sort();
    }
  }

  const { imageOrder: _io, ...productData } = product;
  products.push({ id: folder, ...productData, images });
}

fs.writeFileSync(outputFile, JSON.stringify(products, null, 2));
console.log(`Built catalog with ${products.length} products`);
