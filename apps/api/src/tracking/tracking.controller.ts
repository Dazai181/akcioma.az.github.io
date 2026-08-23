import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { TrackBatchDto } from './dto/track-event.dto';
import { TrackingService } from './tracking.service';

@Controller('track')
export class TrackingController {
  constructor(private tracking: TrackingService) {}

  /**
   * Accept a batch of behavioral events from the client. Auth is optional —
   * guests carry a sessionId via the `aks_session` cookie, logged-in users
   * additionally get attributed via the JWT.
   *
   * Always returns 204 so the client doesn't have to parse a body — useful
   * with fetch({ keepalive: true }) on page unload.
   */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OptionalJwtGuard)
  async ingest(@Body() body: TrackBatchDto, @Req() req: Request) {
    await this.tracking.ingest(body.events, {
      userId: req.user?.id ?? null,
      sessionId: req.aksSession ?? 'anonymous',
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip ?? null,
    });
  }
}
