import { Request, Response } from 'express';
import { z } from 'zod';
import { skillsService } from './skills.service';
import { createSkillSchema, skillIdSchema, updateSkillSchema } from './skills.validation';
import { skillDiscoveryQuerySchema } from './skills.discovery.validation';

export const skillsController = {
  list: async (req: Request, res: Response) => {
    try {
      const query = skillDiscoveryQuerySchema.parse(req.query);
      const result = await skillsService.listSkills(query);
      return res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid skill discovery query.', issues: error.issues } });
      }
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to discover skills.' } });
    }
  },

  create: async (_req: Request, res: Response) => {
    try {
      const payload = createSkillSchema.parse(_req.body);
      const skill = await skillsService.createSkill({ ...payload, userId: _req.user?.id ?? '' });
      return res.status(201).json({ success: true, message: 'Skill created.', data: skill });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Skill validation failed.', issues: error.issues } });
      }
      if (error instanceof Error && error.message === 'DUPLICATE_SKILL') return res.status(409).json({ success: false, error: { code: 'DUPLICATE_SKILL', message: 'You already teach a skill with this title.' } });
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to create skill.' } });
    }
  },

  get: async (req: Request, res: Response) => {
    try {
      const { id } = skillIdSchema.parse(req.params);
      const skill = await skillsService.getSkill(id);
      if (!skill) return res.status(404).json({ success: false, error: { code: 'SKILL_NOT_FOUND', message: 'Skill not found.' } });
      return res.status(200).json({ success: true, data: skill });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid skill ID.', issues: error.issues } });
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to retrieve skill.' } });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = skillIdSchema.parse(req.params);
      const payload = updateSkillSchema.parse(req.body);
      const skill = await skillsService.updateSkill(req.user?.id ?? '', id, payload);
      return res.status(200).json({ success: true, data: skill });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Skill validation failed.', issues: error.issues } });
      if (error instanceof Error && error.message === 'SKILL_NOT_FOUND') return res.status(404).json({ success: false, error: { code: 'SKILL_NOT_FOUND', message: 'Skill not found.' } });
      if (error instanceof Error && error.message === 'FORBIDDEN') return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only modify your own skills.' } });
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to update skill.' } });
    }
  },

  remove: async (req: Request, res: Response) => {
    try {
      const { id } = skillIdSchema.parse(req.params);
      await skillsService.deleteSkill(req.user?.id ?? '', id);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid skill ID.', issues: error.issues } });
      if (error instanceof Error && error.message === 'SKILL_NOT_FOUND') return res.status(404).json({ success: false, error: { code: 'SKILL_NOT_FOUND', message: 'Skill not found.' } });
      if (error instanceof Error && error.message === 'FORBIDDEN') return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only delete your own skills.' } });
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to delete skill.' } });
    }
  },
};
