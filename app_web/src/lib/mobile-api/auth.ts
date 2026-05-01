import { NextResponse } from 'next/server';

import type { MobileApiErrorResponse } from '@personal-trainer/shared/api';

const BEARER_PREFIX = 'Bearer ';

export function authorizeMobileApiRequest(request: Request): NextResponse<MobileApiErrorResponse> | null {
  const expectedToken = process.env.TRAINER_MOBILE_API_TOKEN?.trim();
  if (!expectedToken) {
    return null;
  }

  const authorization = request.headers.get('authorization') ?? '';
  const actualToken = authorization.startsWith(BEARER_PREFIX)
    ? authorization.slice(BEARER_PREFIX.length).trim()
    : '';

  if (actualToken === expectedToken) {
    return null;
  }

  return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
}
