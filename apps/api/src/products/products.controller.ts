import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ListProductsDto } from './dto/list-products.dto';
import { UpsertProductDto } from './dto/upsert-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  @UseGuards(OptionalJwtGuard)
  list(@Query() query: ListProductsDto, @Req() req: Request) {
    return this.products.list(query, req.user?.customerTier ?? 'STANDARD');
  }

  @Get('featured')
  @UseGuards(OptionalJwtGuard)
  featured(@Req() req: Request) {
    return this.products.featured(req.user?.customerTier ?? 'STANDARD');
  }

  @Get('recommended')
  @UseGuards(OptionalJwtGuard)
  recommended(@Req() req: Request) {
    return this.products.recommended(
      req.user?.id ?? null,
      req.user?.customerTier ?? 'STANDARD',
    );
  }

  @Get(':slug')
  @UseGuards(OptionalJwtGuard)
  getBySlug(@Param('slug') slug: string, @Req() req: Request) {
    return this.products.getBySlug(slug, req.user?.customerTier ?? 'STANDARD');
  }

  // ── Admin endpoints ────────────────────────────────────────────────────

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('visibility') visibility?: string,
  ) {
    const v = visibility as 'all' | 'visible' | 'hidden' | undefined;
    if (v && !['all', 'visible', 'hidden'].includes(v)) {
      throw new BadRequestException('Geçersiz görünürlük filtresi.');
    }
    return this.products.adminList({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      categoryId,
      visibility: v,
    });
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminGet(@Param('id') id: string) {
    return this.products.adminGet(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() dto: UpsertProductDto) {
    return this.products.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpsertProductDto) {
    return this.products.update(id, dto);
  }

  @Patch(':id/visibility')
  @UseGuards(JwtAuthGuard, AdminGuard)
  setVisibility(
    @Param('id') id: string,
    @Body('isVisible') isVisible: boolean,
  ) {
    return this.products.setVisibility(id, isVisible);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  delete(@Param('id') id: string) {
    return this.products.delete(id);
  }
}
