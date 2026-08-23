import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Public read-only list of units, used by the storefront to show the unit beside prices. */
@Controller('units')
export class PublicUnitsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.unit.findMany({
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
      select: { id: true, code: true, name: true },
    });
  }
}
