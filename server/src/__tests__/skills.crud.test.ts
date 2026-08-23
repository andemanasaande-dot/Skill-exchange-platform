import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSkillsRouter } from '../modules/skills/routes';
import { skillsRepository } from '../modules/skills/skills.repository';
import { skillsService } from '../modules/skills/skills.service';

const skill = (overrides = {}) => ({
  id: 'skill_java', userId: 'user_alice', categoryId: 'category_programming', title: 'Java', description: 'Backend programming', isActive: true, createdAt: new Date(), updatedAt: new Date(), ...overrides,
});

const createApp = (userId = 'user_alice') => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { id: userId, email: `${userId}@example.com`, role: 'USER', status: 'ACTIVE' }; next(); });
  app.use('/api/v1/skills', createSkillsRouter());
  return app;
};

describe('skills CRUD and ownership', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates and retrieves a skill for its owner', async () => {
    vi.spyOn(skillsRepository, 'create').mockResolvedValue(skill() as never);
    vi.spyOn(skillsRepository, 'getById').mockResolvedValue(skill() as never);
    const created = await request(createApp()).post('/api/v1/skills').send({ title: 'Java', categoryId: 'category_programming', description: 'Backend programming' });
    const retrieved = await request(createApp()).get('/api/v1/skills/skill_java');
    expect(created.status).toBe(201);
    expect(created.body.data.userId).toBe('user_alice');
    expect(retrieved.status).toBe(200);
  });

  it('prevents duplicate skill titles per owner', async () => {
    vi.spyOn(skillsRepository, 'create').mockRejectedValue({ code: 'P2002' });
    const response = await request(createApp()).post('/api/v1/skills').send({ title: 'Java', categoryId: 'category_programming' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DUPLICATE_SKILL');
  });

  it('prevents IDOR updates and deletes', async () => {
    vi.spyOn(skillsRepository, 'getById').mockResolvedValue(skill({ userId: 'user_bob' }) as never);
    const update = await request(createApp('user_alice')).put('/api/v1/skills/skill_java').send({ title: 'Changed' });
    const remove = await request(createApp('user_alice')).delete('/api/v1/skills/skill_java');
    expect(update.status).toBe(403);
    expect(remove.status).toBe(403);
  });

  it('updates and deletes only the owner skill', async () => {
    vi.spyOn(skillsRepository, 'getById').mockResolvedValue(skill() as never);
    vi.spyOn(skillsRepository, 'update').mockResolvedValue(skill({ title: 'Java Advanced' }) as never);
    const remove = vi.spyOn(skillsRepository, 'delete').mockResolvedValue(skill() as never);
    const update = await request(createApp()).put('/api/v1/skills/skill_java').send({ title: 'Java Advanced' });
    const deleted = await request(createApp()).delete('/api/v1/skills/skill_java');
    expect(update.status).toBe(200);
    expect(deleted.status).toBe(204);
    expect(remove).toHaveBeenCalledWith('skill_java');
  });

  it('keeps discovery search and pagination server-side', async () => {
    const list = vi.spyOn(skillsService, 'listSkills').mockResolvedValue({ data: [skill()], pagination: { page: 2, limit: 1, total: 3, totalPages: 3 } } as never);
    const response = await request(createApp()).get('/api/v1/skills?search=java&page=2&limit=1&sort=title_asc');
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ search: 'java', page: 2, limit: 1, sort: 'title_asc' }));
    expect(response.body.pagination.totalPages).toBe(3);
  });
});
