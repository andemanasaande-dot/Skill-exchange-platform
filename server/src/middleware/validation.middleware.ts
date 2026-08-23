import type { NextFunction, Request, Response } from 'express';
import { z, type ZodTypeAny, type ZodIssue } from 'zod';

export type ValidationTarget = 'body' | 'params' | 'query';

export type StandardValidationError = {
  success: false;
  error: {
    code: 'VALIDATION_ERROR' | 'INVALID_ID';
    message: string;
    issues: Array<{
      path: string[];
      message: string;
    }>;
  };
};

const normalizeIssues = (issues: ZodIssue[]) =>
  issues.map((issue) => ({
    path: issue.path.length ? issue.path.map(String) : ['value'],
    message: issue.message,
  }));

const sendValidationError = (
  res: Response,
  statusCode: number,
  code: StandardValidationError['error']['code'],
  message: string,
  issues: ZodIssue[],
) => {
  const response: StandardValidationError = {
    success: false,
    error: {
      code,
      message,
      issues: normalizeIssues(issues),
    },
  };

  return res.status(statusCode).json(response);
};

const parseWithGuard = <T extends ZodTypeAny>(
  schema: T,
  value: unknown,
  target: ValidationTarget,
): { success: true; data: z.infer<T> } | { success: false; error: ZodIssue[] } => {
  try {
    const parsed = schema.safeParse(value);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues,
      };
    }

    return {
      success: true,
      data: parsed.data,
    };
  } catch (error) {
    const fallbackIssue: ZodIssue = {
      code: 'custom',
      path: [target],
      message: 'Unsafe input could not be validated safely.',
      fatal: false,
      received: value,
    } as ZodIssue;

    return {
      success: false,
      error: [fallbackIssue],
    };
  }
};

export const validateBody = <T extends ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = parseWithGuard(schema, req.body ?? {}, 'body');

    if (!parsed.success) {
      const invalidId = parsed.error.some((issue) => issue.message.toLowerCase().includes('uuid') || issue.path.includes('id'));
      return sendValidationError(
        res,
        invalidId ? 400 : 400,
        invalidId ? 'INVALID_ID' : 'VALIDATION_ERROR',
        invalidId ? 'Invalid path identifier provided.' : 'Request validation failed.',
        parsed.error,
      );
    }

    req.body = parsed.data;
    next();
  };
};

export const validateParams = <T extends ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = parseWithGuard(schema, req.params ?? {}, 'params');

    if (!parsed.success) {
      const invalidId = parsed.error.some((issue) => issue.path.includes('id') || issue.message.toLowerCase().includes('uuid'));
      return sendValidationError(
        res,
        400,
        invalidId ? 'INVALID_ID' : 'VALIDATION_ERROR',
        invalidId ? 'Invalid request parameter.' : 'Request validation failed.',
        parsed.error,
      );
    }

    req.params = parsed.data as typeof req.params;
    next();
  };
};

export const validateQuery = <T extends ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = parseWithGuard(schema, req.query ?? {}, 'query');

    if (!parsed.success) {
      return sendValidationError(
        res,
        400,
        'VALIDATION_ERROR',
        'Query validation failed.',
        parsed.error,
      );
    }

    req.query = parsed.data as typeof req.query;
    next();
  };
};

export const validateRequest = <TBody extends ZodTypeAny, TParams extends ZodTypeAny = ZodTypeAny, TQuery extends ZodTypeAny = ZodTypeAny>(
  schemas: {
    body?: TBody;
    params?: TParams;
    query?: TQuery;
  },
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const bodyResult = schemas.body ? parseWithGuard(schemas.body, req.body ?? {}, 'body') : { success: true as const, data: req.body };
    const paramsResult = schemas.params ? parseWithGuard(schemas.params, req.params ?? {}, 'params') : { success: true as const, data: req.params };
    const queryResult = schemas.query ? parseWithGuard(schemas.query, req.query ?? {}, 'query') : { success: true as const, data: req.query };

    const failed = [bodyResult, paramsResult, queryResult].find((result) => !result.success);

    if (failed && 'error' in failed) {
      const invalidId = failed.error.some(
        (issue) => issue.path.includes('id') || issue.message.toLowerCase().includes('uuid'),
      );

      return sendValidationError(
        res,
        400,
        invalidId ? 'INVALID_ID' : 'VALIDATION_ERROR',
        invalidId ? 'Invalid request identifier provided.' : 'Request validation failed.',
        failed.error,
      );
    }

    if (bodyResult.success) req.body = bodyResult.data;
    if (paramsResult.success) req.params = paramsResult.data as typeof req.params;
    if (queryResult.success) req.query = queryResult.data as typeof req.query;

    next();
  };
};
