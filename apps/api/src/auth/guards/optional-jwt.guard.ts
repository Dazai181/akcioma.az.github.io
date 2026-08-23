import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Attaches req.user when JWT is present; does NOT throw if missing. */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any) {
    return user ?? null;
  }
}
