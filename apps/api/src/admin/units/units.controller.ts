import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { UnitsService } from './units.service';

class CreateUnitDto {
  @IsString() code!: string;
  @IsOptional() @IsString() name?: string;
}

class RenameUnitDto {
  @IsString() name!: string;
}

@Controller('admin/units')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UnitsController {
  constructor(private units: UnitsService) {}

  @Get() list() { return this.units.list(); }

  @Post() create(@Body() dto: CreateUnitDto) {
    return this.units.create(dto.code, dto.name ?? dto.code);
  }

  @Patch(':id') rename(@Param('id') id: string, @Body() dto: RenameUnitDto) {
    return this.units.rename(id, dto.name);
  }

  @Delete(':id') delete(@Param('id') id: string) {
    return this.units.delete(id);
  }
}
