import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CustomerTier } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { CustomersService } from './customers.service';

class SetTierDto {
  @IsEnum(CustomerTier)
  tier!: CustomerTier;
}

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('tier') tier?: CustomerTier,
  ) {
    return this.customers.list({ search, tier, limit: 200 });
  }

  @Patch(':id/tier')
  setTier(@Param('id') id: string, @Body() dto: SetTierDto) {
    return this.customers.setTier(id, dto.tier);
  }
}
