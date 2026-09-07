const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.wczvobykkxxwkvhsznwe:Aksioma%2F014@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
    }
  }
});

async function main() {
  const pwd = await bcrypt.hash('admin1234', 12);
  await prisma.user.upsert({
    where: { mobile: '+994515608025' },
    update: {
      isAdmin: true,
      isVerified: true,
      passwordHash: pwd
    },
    create: {
      firstName: 'Elturan',
      lastName: 'Ağalarlı',
      mobile: '+994515608025',
      isAdmin: true,
      isVerified: true,
      passwordHash: pwd
    }
  });
  console.log('User created and made admin!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
