import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ConflictStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { ConflictsService } from './conflicts.service';
import { ResolveConflictDto } from './dto/resolve.dto';

@Controller('admin/conflicts')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ConflictsController {
  constructor(private conflicts: ConflictsService) {}

  @Get()
  list(@Query('status') status?: string) {
    const valid: ConflictStatus[] = ['UNRESOLVED', 'KEPT_EXISTING', 'KEPT_INCOMING', 'MERGED'];
    if (status && !valid.includes(status as ConflictStatus)) {
      throw new BadRequestException('Geçersiz durum.');
    }
    return this.conflicts.list(status as ConflictStatus | undefined);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.conflicts.get(id);
  }

  @Post(':id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveConflictDto,
    @Req() req: Request,
  ) {
    if (!req.user) throw new BadRequestException('Kimlik doğrulanamadı.');
    return this.conflicts.resolve(id, dto, req.user.id);
  }
}
