import { Request, Response } from 'express';
import { adminService } from './admin.service';
import { z } from 'zod';
import { categoryCreateSchema, categoryUpdateSchema, skillStatusSchema } from './admin.validation';

export const adminController = {
  dashboard: async (_req: Request, res: Response) => {
    const summary = await adminService.getDashboardSummary();
    res.status(200).json({ success: true, data: summary });
  },
  users: async (req: Request, res: Response) => res.status(200).json({ success: true, data: await adminService.listUsers(typeof req.query.search === 'string' ? req.query.search : undefined) }),
  user: async (req: Request, res: Response) => { const user = await adminService.getUser(req.params.id as string); return user ? res.status(200).json({ success: true, data: user }) : res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } }); },
  activateUser: async (req: Request, res: Response) => { try { const user = await adminService.activateUser(req.params.id as string, req.user?.id ?? ''); return res.status(200).json({ success: true, data: user }); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid user ID.' } }); return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } }); } },
  categories: async (_req: Request, res: Response) => res.status(200).json({ success: true, data: await adminService.listCategories() }),
  updateSkillStatus: async (req: Request, res: Response) => { try { const skill = await adminService.updateSkillStatus(req.params.id as string, skillStatusSchema.parse(req.body).isActive, req.user?.id ?? ''); return res.status(200).json({ success: true, data: skill }); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid skill status.' } }); return res.status(404).json({ success: false, error: { code: 'SKILL_NOT_FOUND', message: 'Skill not found.' } }); } },
  createCategory: async (req: Request, res: Response) => { try { return res.status(201).json({ success: true, data: await adminService.createCategory(categoryCreateSchema.parse(req.body)) }); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid category.' } }); return res.status(409).json({ success: false, error: { code: 'CATEGORY_CONFLICT', message: 'Category name or slug already exists.' } }); } },
  updateCategory: async (req: Request, res: Response) => { try { return res.status(200).json({ success: true, data: await adminService.updateCategory(req.params.id as string, categoryUpdateSchema.parse(req.body)) }); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid category.' } }); return res.status(404).json({ success: false, error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' } }); } },
  deleteCategory: async (req: Request, res: Response) => { try { await adminService.deleteCategory(req.params.id as string); return res.status(204).send(); } catch { return res.status(409).json({ success: false, error: { code: 'CATEGORY_IN_USE', message: 'Categories used by skills cannot be deleted.' } }); } },
};
