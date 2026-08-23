import { Request, Response } from 'express';
import { adminService } from './admin.service';
import { z } from 'zod';

export const adminController = {
  dashboard: async (_req: Request, res: Response) => {
    const summary = await adminService.getDashboardSummary();
    res.status(200).json({ success: true, data: summary });
  },
  users: async (req: Request, res: Response) => res.status(200).json({ success: true, data: await adminService.listUsers(typeof req.query.search === 'string' ? req.query.search : undefined) }),
  user: async (req: Request, res: Response) => { const user = await adminService.getUser(req.params.id as string); return user ? res.status(200).json({ success: true, data: user }) : res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } }); },
  activateUser: async (req: Request, res: Response) => { try { const user = await adminService.activateUser(req.params.id as string, req.user?.id ?? ''); return res.status(200).json({ success: true, data: user }); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid user ID.' } }); return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } }); } },
  categories: async (_req: Request, res: Response) => res.status(200).json({ success: true, data: await adminService.listCategories() }),
};
