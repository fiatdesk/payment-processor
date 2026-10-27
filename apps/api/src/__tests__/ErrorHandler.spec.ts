// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedUser } from '@fiatdesk/shared-types';
import { ErrorHandler } from '../middleware/ErrorHandler';
import { AppError } from '../utils/AppError';

// main.ts declares `req.user`; tests do not load main.ts.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: AuthenticatedUser;
    }
  }
}

jest.mock('../utils/Logger', () => ({
  Logger: { error: jest.fn() },
}));

function Respond(error: unknown) {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  ErrorHandler(
    error,
    {
      path: '/v1/payment_pages/x/confirm',
      method: 'POST',
      headers: {},
    } as Request,
    res as unknown as Response,
    jest.fn() as NextFunction
  );
  return res;
}

describe('ErrorHandler', () => {
  it('returns an AppError with its details in the error body', () => {
    const res = Respond(
      new AppError('Still confirming', 409, 'payment_pending', {
        code: 'payment_pending',
        transaction_hash: `0x${'ab'.repeat(32)}`,
        // Details never replace the message or type.
        message: 'ignored',
        type: 'ignored',
      })
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'payment_pending',
        transaction_hash: `0x${'ab'.repeat(32)}`,
        message: 'Still confirming',
        type: 'payment_pending',
      },
    });
  });

  it('returns an AppError without details as message and type', () => {
    const res = Respond(new AppError('Nope', 400, 'invalid_request_error'));

    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Nope', type: 'invalid_request_error' },
    });
  });
});
