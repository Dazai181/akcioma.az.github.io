import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateFlashSaleDto, UpdateFlashSaleDto } from './dto/flash-sale.dto';
import { FlashSalesService } from './flash-sales.service';

@Controller('flash-sales')
export class FlashSalesController {
  constructor(private service: FlashSalesService) {}

  @Get()
  publicActive() {
    return this.service.publicActive();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList(@Query('filter') filter?: string) {
    const f = (filter ?? 'all') as 'all' | 'active' | 'upcoming' | 'expired';
    if (!['all', 'active', 'upcoming', 'expired'].includes(f)) {
      throw new BadRequestException('Geçersiz filtre.');
    }
    return this.service.list(f);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() dto: CreateFlashSaleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateFlashSaleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
