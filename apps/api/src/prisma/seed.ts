import { PrismaClient, CustomerTier } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Yazı Gereçleri', slug: 'yazi-gerecleri' },
  { name: 'Defter & Bloknot', slug: 'defter-bloknot' },
  { name: 'Ofis Aksesuarları', slug: 'ofis-aksesuarlari' },
];

const UNITS: { code: string; name: string }[] = [
  { code: 'adet', name: 'Adet' },
  { code: 'paket', name: 'Paket' },
  { code: 'kutu', name: 'Kutu' },
  { code: 'kg', name: 'Kilogram' },
  { code: 'gr', name: 'Gram' },
  { code: 'lt', name: 'Litre' },
  { code: 'ml', name: 'Mililitre' },
  { code: 'm', name: 'Metre' },
  { code: 'cm', name: 'Santimetre' },
  { code: 'set', name: 'Set' },
  { code: 'top', name: 'Top' },
  { code: 'koli', name: 'Koli' },
  { code: 'rulo', name: 'Rulo' },
];

const PRODUCT_NAMES = [
  'Tükenmez Kalem Mavi',
  'Tükenmez Kalem Siyah',
  'Roller Kalem 0.7',
  'Kurşun Kalem HB',
  'Silgi Beyaz',
  'Kalemtıraş Metal',
  'Cetvel 30cm',
  'Marker Kalem Set',
  'Fosforlu Kalem Sarı',
  'Fosforlu Kalem Pembe',
  'A4 Spiralli Defter',
  'A5 Bloknot Çizgili',
  'Karton Kapak Defter',
  'Yapışkanlı Not Kağıdı',
  'Post-it Mini Set',
  'Klasör A4 Geniş',
  'Telli Dosya 50li',
  'Şeffaf Poşet Dosya',
  'Zarf Beyaz A4',
  'Zarf Kraft Büyük',
  'Zımba Makinesi',
  'Zımba Teli 24/6',
  'Delgeç 2 Delik',
  'Ataç 50mm 100lü',
  'Yapıştırıcı Stick',
  'Bant Şeffaf 18mm',
  'Bant Kesici Masa',
  'Hesap Makinesi 12 Hane',
  'Stapler Pense',
  'Damga Mürekkep',
];

function pickPrices(base: number) {
  const standard = base;
  const favorite = Math.round(base * 0.85 * 100) / 100;
  const special = Math.round(base * 0.7 * 100) / 100;
  return [
    { tier: 'STANDARD' as CustomerTier, price: standard },
    { tier: 'FAVORITE' as CustomerTier, price: favorite },
    { tier: 'SPECIAL' as CustomerTier, price: special },
  ];
}

function slugify(name: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  return name
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('Seeding…');

  // Categories
  const categoryIds: string[] = [];
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
    categoryIds.push(cat.id);
  }

  // Units
  for (const u of UNITS) {
    await prisma.unit.upsert({
      where: { code: u.code },
      update: { name: u.name, isSystem: true },
      create: { code: u.code, name: u.name, isSystem: true },
    });
  }
  const defaultUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'adet' } });

  // Users
  const adminPwd = await bcrypt.hash('admin1234', 12);
  await prisma.user.upsert({
    where: { mobile: '+905550000001' },
    update: {},
    create: {
      firstName: 'Admin',
      lastName: 'Aksioma',
      mobile: '+905550000001',
      passwordHash: adminPwd,
      isVerified: true,
      isAdmin: true,
      customerTier: 'STANDARD',
    },
  });

  const userPwd = await bcrypt.hash('test1234', 12);
  for (const [tier, mobile, fname, lname] of [
    ['STANDARD', '+905550000010', 'Test', 'Standard'],
    ['FAVORITE', '+905550000011', 'Test', 'Favorite'],
    ['SPECIAL', '+905550000012', 'Test', 'Special'],
  ] as const) {
    await prisma.user.upsert({
      where: { mobile },
      update: {},
      create: {
        firstName: fname,
        lastName: lname,
        mobile,
        passwordHash: userPwd,
        isVerified: true,
        customerTier: tier,
      },
    });
  }

  // Products
  let i = 0;
  for (const name of PRODUCT_NAMES) {
    const slug = slugify(name);
    const base = 10 + Math.round(Math.random() * 200);
    const stockSeed = (i * 7) % 30;
    await prisma.product.upsert({
      where: { slug },
      update: { unitId: defaultUnit.id },
      create: {
        name,
        slug,
        description: `${name} — yüksek kalite ofis ve kırtasiye ürünü.`,
        sku: `AKS-${String(1000 + i).padStart(4, '0')}`,
        barcode: `869${String(2000000 + i).padStart(7, '0')}${i % 10}`,
        stockQty: stockSeed === 0 ? 3 : stockSeed,
        categoryId: categoryIds[i % categoryIds.length],
        unitId: defaultUnit.id,
        prices: { create: pickPrices(base) },
        images: {
          create: [
            {
              url: `https://picsum.photos/seed/${slug}/600/600`,
              isPrimary: true,
            },
          ],
        },
      },
    });
    i++;
  }

  // Games — created disabled. Admin enables them from /admin/games.
  const SPIN_WHEEL_REWARDS = [
    { label: '5% İndirim', type: 'DISCOUNT_PERCENT' as const, value: 5, weight: 30, couponCode: 'SPIN5' },
    { label: '10% İndirim', type: 'DISCOUNT_PERCENT' as const, value: 10, weight: 20, couponCode: 'SPIN10' },
    { label: '20% İndirim', type: 'DISCOUNT_PERCENT' as const, value: 20, weight: 5, couponCode: 'SPIN20' },
    { label: 'Ücretsiz Kargo', type: 'FREE_SHIPPING' as const, value: null, weight: 15, couponCode: 'SPINSHIP' },
    { label: '50 Puan', type: 'POINTS' as const, value: 50, weight: 20, couponCode: null },
    { label: 'Tekrar Dene', type: 'NOTHING' as const, value: null, weight: 10, couponCode: null },
  ];

  const DAILY_CHECKIN_REWARDS = [
    { label: '10 Puan', type: 'POINTS' as const, value: 10, weight: 50, couponCode: null },
    { label: '25 Puan', type: 'POINTS' as const, value: 25, weight: 30, couponCode: null },
    { label: '5% İndirim', type: 'DISCOUNT_PERCENT' as const, value: 5, weight: 18, couponCode: 'CHECKIN5' },
    { label: 'Ücretsiz Kargo', type: 'FREE_SHIPPING' as const, value: null, weight: 2, couponCode: 'CHECKINSHIP' },
  ];

  for (const [type, config, rewards] of [
    ['SPIN_WHEEL', { cooldownHours: 24 }, SPIN_WHEEL_REWARDS],
    ['DAILY_CHECKIN', { cooldownHours: 24, maxPlaysPerDay: 1 }, DAILY_CHECKIN_REWARDS],
  ] as const) {
    const game = await prisma.game.upsert({
      where: { type },
      update: {},
      create: { type, isEnabled: false, config },
    });
    const existingRewardCount = await prisma.gameReward.count({ where: { gameId: game.id } });
    if (existingRewardCount === 0) {
      for (const r of rewards) {
        await prisma.gameReward.create({ data: { ...r, gameId: game.id } });
      }
    }
  }

  console.log(`Done. Seeded ${UNITS.length} units, ${CATEGORIES.length} categories, 4 users, ${PRODUCT_NAMES.length} products, 2 games.`);
  console.log('Admin login → mobile +905550000001 / password admin1234');
  console.log('Test users → mobile +90555000001[0|1|2] / password test1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
