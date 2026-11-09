import type { Request, Response, NextFunction } from 'express';

interface HttpErrorLike {
  status?: number;
  statusCode?: number;
  message?: string;
}

function resolveStatusCode(err: unknown): number {
  if (typeof err === 'object' && err !== null) {
    const rawStatus = (err as HttpErrorLike).status ?? (err as HttpErrorLike).statusCode;
    if (typeof rawStatus === 'number' && Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599) {
      return rawStatus;
    }
  }
  return 500;
}

function resolveErrorTitle(status: number): string {
  switch (status) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 413:
      return 'Payload Too Large';
    case 415:
      return 'Unsupported Media Type';
    case 422:
      return 'Unprocessable Entity';
    default:
      return status >= 500 ? 'Internal Server Error' : 'Request Error';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = resolveStatusCode(err);
  const errorTitle = resolveErrorTitle(status);
  const message = err instanceof Error ? err.message : 'Internal Server Error';

  console.error(`[ServerError] Status ${status} (${errorTitle}):`, err);

  const isInternalServerError = status >= 500;
  res.status(status).json({
    error: errorTitle,
    message: process.env.NODE_ENV === 'production' && isInternalServerError ? undefined : message,
  });
}
