import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSkillsRouter } from '../modules/skills/routes';
import { skillsService } from '../modules/skills/skills.service';

const createApp = () => {
  const app = express();
  app.use('/api/v1/skills', createSkillsRouter());
  return app;
};

const skill = (id: string, title: string, isActive = true) => ({
  id,
  title,
  description: `${title} description`,
  isActive,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  owner: { id: 'user_1', name: 'Alice' },
  category: { id: 'category_1', name: 'Programming', slug: 'programming' },
});

describe('skill discovery', () => {
  afterEach(() => vi.restoreAllMocks());

  it('supports case-insensitive search', async () => {
    const list = vi.spyOn(skillsService, 'listSkills').mockResolvedValue({ data: [skill('skill_1', 'TypeScript')], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });

    const response = await request(createApp()).get('/api/v1/skills?search=typescript');

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ search: 'typescript', active: true }));
    expect(response.body.success).toBe(true);
    expect(response.body.data[0].title).toBe('TypeScript');
  });

  it('supports category and owner filtering', async () => {
    const list = vi.spyOn(skillsService, 'listSkills').mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });

    const response = await request(createApp()).get('/api/v1/skills?category=programming&owner=user_1');

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ category: 'programming', owner: 'user_1' }));
  });

  it('returns pagination metadata and supports inactive skills explicitly', async () => {
    const list = vi.spyOn(skillsService, 'listSkills').mockResolvedValue({ data: [skill('skill_2', 'Legacy Skill', false)], pagination: { page: 2, limit: 2, total: 5, totalPages: 3 } });

    const response = await request(createApp()).get('/api/v1/skills?page=2&limit=2&active=false&sort=oldest');

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 2, active: false, sort: 'oldest' }));
    expect(response.body.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(response.body.data[0].isActive).toBe(false);
  });

  it('rejects invalid query parameters and excessive page sizes', async () => {
    const invalidPage = await request(createApp()).get('/api/v1/skills?page=0');
    const excessiveLimit = await request(createApp()).get('/api/v1/skills?limit=101');
    const invalidActive = await request(createApp()).get('/api/v1/skills?active=yes');

    expect(invalidPage.status).toBe(400);
    expect(excessiveLimit.status).toBe(400);
    expect(invalidActive.status).toBe(400);
  });

  it('defaults discovery to active skills only', async () => {
    const list = vi.spyOn(skillsService, 'listSkills').mockResolvedValue({ data: [skill('skill_1', 'Active Skill')], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });

    const response = await request(createApp()).get('/api/v1/skills');

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20, active: true, sort: 'newest' }));
    expect(response.body.data.every((item: { isActive: boolean }) => item.isActive)).toBe(true);
  });
});
