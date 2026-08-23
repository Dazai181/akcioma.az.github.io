import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const COOKIE_NAME = 'aks_session';
const ONE_YEAR = 60 * 60 * 24 * 365 * 1000;

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const existing = req.cookies?.[COOKIE_NAME];
    const token = existing ?? randomUUID();

    if (!existing) {
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: ONE_YEAR,
        path: '/',
      });
    }

    req.aksSession = token;
    next();
  }
}
