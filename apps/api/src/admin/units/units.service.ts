import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.unit.findMany({
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async create(code: string, name: string) {
    const normalized = code.trim().toLowerCase();
    if (!normalized) throw new BadRequestException('Birim kodu boş olamaz.');
    const exists = await this.prisma.unit.findUnique({ where: { code: normalized } });
    if (exists) throw new ConflictException('Bu birim kodu zaten kayıtlı.');
    return this.prisma.unit.create({
      data: { code: normalized, name: name.trim() || normalized, isSystem: false },
    });
  }

  async rename(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Birim adı boş olamaz.');
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Birim bulunamadı.');
    return this.prisma.unit.update({
      where: { id },
      data: { name: trimmed },
    });
  }

  async delete(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!unit) throw new NotFoundException('Birim bulunamadı.');
    if (unit.isSystem) {
      throw new BadRequestException('Sistem birimleri silinemez.');
    }
    if (unit._count.products > 0) {
      throw new ConflictException(
        `Bu birim ${unit._count.products} ürüne atanmış. Önce ürünleri başka bir birime taşıyın.`,
      );
    }
    await this.prisma.unit.delete({ where: { id } });
    return { id, deleted: true };
  }
}
