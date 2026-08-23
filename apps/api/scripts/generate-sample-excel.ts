import * as XLSX from 'xlsx';
import * as path from 'path';

/**
 * Builds a sample Excel that exercises every code path in the sync pipeline:
 *   1.   New product with seeded unit (kg) → CREATED
 *   2.   New product with brand-new unit (düzine) → CREATED + Unit auto-created
 *   3.   Name matches a seeded product, different price → MATERIAL CONFLICT
 *   4.   Barcode matches a seeded product, different name → MATERIAL CONFLICT
 *   5.   Unknown category_slug → row error (failedRows + 1)
 *   6.   Missing required field (standard_price) → parse error (failedRows + 1)
 */

const rows = [
  // 1 — new product using seeded unit
  {
    name: 'Premium Roller Kalem 0.5',
    category_slug: 'yazi-gerecleri',
    stock_qty: 50,
    unit: 'adet',
    standard_price: 45.0,
    favorite_price: 38.0,
    special_price: 30.0,
    sku: 'AKS-9001',
    barcode: '8690000099001',
    description: 'Yumuşak yazım, mavi mürekkep',
  },
  // 2 — new product introducing a UNIT THAT DOES NOT EXIST YET
  //      Sync pipeline should auto-create the "düzine" unit.
  {
    name: 'Hediyelik Kalem Düzinesi',
    category_slug: 'yazi-gerecleri',
    stock_qty: 12,
    unit: 'düzine',
    standard_price: 220.0,
    favorite_price: 195.0,
    special_price: '',
    sku: 'AKS-9002',
    barcode: '8690000099002',
    description: '12 adetli set',
  },
  // 3 — collides with seeded "Tükenmez Kalem Mavi" by NAME
  //      Different price → admin must resolve in conflicts UI
  {
    name: 'Tükenmez Kalem Mavi',
    category_slug: 'yazi-gerecleri',
    stock_qty: 75,
    unit: 'adet',
    standard_price: 19.99,
    favorite_price: 17.0,
    special_price: 14.0,
    sku: 'AKS-9003',
    barcode: '8690000099003',
    description: 'Yeni tedarikçiden gelen sürüm',
  },
  // 4 — collides with seeded product by BARCODE (first seeded = '86920000000')
  //      Different name + different unit → MATERIAL conflict
  {
    name: 'BAŞKA İSİM (barkod çakışması testi)',
    category_slug: 'yazi-gerecleri',
    stock_qty: 10,
    unit: 'paket',
    standard_price: 12.5,
    favorite_price: '',
    special_price: '',
    sku: '',
    barcode: '86920000000',
    description: '',
  },
  // 5 — unknown category → row error during processing
  {
    name: 'Geçersiz Kategorili Ürün',
    category_slug: 'olmayan-kategori',
    stock_qty: 5,
    unit: 'kg',
    standard_price: 10.0,
    favorite_price: '',
    special_price: '',
    sku: 'AKS-9005',
    barcode: '8690000099005',
    description: '',
  },
  // 6 — missing standard_price → parse error
  {
    name: 'Eksik Fiyatlı Ürün',
    category_slug: 'ofis-aksesuarlari',
    stock_qty: 8,
    unit: '',
    standard_price: '',
    favorite_price: '',
    special_price: '',
    sku: 'AKS-9006',
    barcode: '8690000099006',
    description: '',
  },
];

const ws = XLSX.utils.json_to_sheet(rows, {
  header: [
    'name',
    'category_slug',
    'stock_qty',
    'unit',
    'standard_price',
    'favorite_price',
    'special_price',
    'sku',
    'barcode',
    'description',
  ],
});
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'products');

const out = path.resolve(__dirname, '..', 'sample-data', 'test-products.xlsx');
require('fs').mkdirSync(path.dirname(out), { recursive: true });
XLSX.writeFile(wb, out);

console.log(`Wrote ${rows.length} rows → ${out}`);
console.log('');
console.log('Expected outcomes after upload:');
console.log('  • Row 1      → CREATED (unit: adet)');
console.log('  • Row 2      → CREATED + Unit "düzine" auto-created');
console.log('  • Row 3      → MATERIAL CONFLICT (matched by name)');
console.log('  • Row 4      → MATERIAL CONFLICT (matched by barcode)');
console.log('  • Row 5      → row error (kategori bulunamadı: olmayan-kategori)');
console.log('  • Row 6      → parse error (eksik standard_price)');
console.log('  Job summary: success=2, failed=4, conflicts=2');
console.log('  Check /admin/units → "düzine" should appear (non-system).');
