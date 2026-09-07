const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.wczvobykkxxwkvhsznwe:Aksioma%2F014@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
    }
  }
});
async function check() {
  const u = await prisma.user.findUnique({ where: { mobile: '+994515608025' }});
  console.log('User in DB:', u);
}
check().finally(() => prisma.$disconnect());
