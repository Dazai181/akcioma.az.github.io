const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.wczvobykkxxwkvhsznwe:Aksioma%2F014@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
    }
  }
});

async function main() {
  await prisma.user.update({
    where: { mobile: '+994515608025' },
    data: { isAdmin: true }
  });
  console.log('Admin rights granted!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
