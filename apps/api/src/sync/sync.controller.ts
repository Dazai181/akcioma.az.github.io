import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SyncService } from './sync.service';

const MAX_UPLOAD_MB = 50;

const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
  'application/csv',
  'application/octet-stream', // some browsers send this for .xlsx
]);

/**
 * Magic-byte sniff so a renamed `.exe` posted as `report.xlsx` is rejected
 * even if the browser sends a permissive MIME. xlsx files are zip-based
 * (PK..), xls is a compound document (D0 CF 11 E0), CSV is plain text we
 * accept loosely.
 */
function looksLikeSpreadsheet(buf: Buffer, fileName: string): boolean {
  if (buf.length < 4) return false;
  if (/\.csv$/i.test(fileName)) return true;
  // ZIP magic for xlsx: 50 4B 03 04
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return true;
  // OLE compound document for legacy xls
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return true;
  return false;
}

@Controller('admin/sync')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SyncController {
  constructor(private sync: SyncService) {}

  @Post('excel/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
    }),
  )
  async uploadExcel(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Dosya yüklenmedi.');
    if (!file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      throw new BadRequestException('Yalnızca .xlsx, .xls veya .csv dosyaları kabul edilir.');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`Geçersiz dosya türü: ${file.mimetype}`);
    }
    if (!looksLikeSpreadsheet(file.buffer, file.originalname)) {
      throw new BadRequestException('Dosya içeriği geçerli bir Excel/CSV değil.');
    }
    if (!req.user) throw new BadRequestException('Kimlik doğrulanamadı.');
    const job = await this.sync.triggerExcel(file.buffer, file.originalname, req.user.id);
    return job;
  }

  @Post('erp/trigger')
  async triggerErp(@Req() req: Request) {
    if (!req.user) throw new BadRequestException('Kimlik doğrulanamadı.');
    return this.sync.triggerErp(req.user.id);
  }

  @Get('jobs')
  listJobs() {
    return this.sync.listJobs(50);
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string) {
    return this.sync.getJob(id);
  }
}
