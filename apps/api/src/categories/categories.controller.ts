import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('categories')
export class CategoriesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.category.findMany({
      where: { isVisible: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, parentId: true },
    });
  }
}
