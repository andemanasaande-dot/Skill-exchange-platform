import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUsersRouter } from '../modules/users/routes';
import { interestsRepository } from '../modules/users/interests.repository';

const createApp = () => {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = { id: 'user_1', email: 'alice@example.com', role: 'USER', status: 'ACTIVE' };
    next();
  });
  app.use('/api/v1', createUsersRouter());
  return app;
};

describe('user skill interests', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists learning interests separately from teaching skills', async () => {
    vi.spyOn(interestsRepository, 'listTeachingByUserId').mockResolvedValue([
      { id: 'skill_teach_1', title: 'TypeScript', description: null, isActive: true, category: { id: 'cat_1', name: 'Programming', slug: 'programming' } },
    ] as never);
    vi.spyOn(interestsRepository, 'listByUserId').mockResolvedValue([
      { id: 'interest_1', skillId: 'skill_1', interestType: 'LEARN', createdAt: new Date(), skill: { id: 'skill_1', title: 'Spanish', description: null, isActive: true, category: { id: 'cat_1', name: 'Languages', slug: 'languages' } } },
    ] as never);

    const response = await request(createApp()).get('/api/v1/profile/interests');

    expect(response.status).toBe(200);
    expect(response.body.data.skillsToTeach[0].title).toBe('TypeScript');
    expect(response.body.data.skillsToLearn[0].skill.title).toBe('Spanish');
  });

  it('adds an active existing skill as a learning interest for the authenticated user', async () => {
    vi.spyOn(interestsRepository, 'findSkill').mockResolvedValue({ id: 'skill_1', title: 'Spanish', description: null, isActive: true, category: null } as never);
    vi.spyOn(interestsRepository, 'findByUserAndSkill').mockResolvedValue(null);
    vi.spyOn(interestsRepository, 'create').mockResolvedValue({ id: 'interest_1', skillId: 'skill_1', interestType: 'LEARN', createdAt: new Date(), skill: { id: 'skill_1', title: 'Spanish', isActive: true } } as never);

    const response = await request(createApp()).post('/api/v1/profile/interests').send({ skillId: 'skill_1' });

    expect(response.status).toBe(201);
    expect(response.body.data.interest.interestType).toBe('LEARN');
    expect(interestsRepository.create).toHaveBeenCalledWith('user_1', 'skill_1');
  });

  it('rejects missing, inactive, and duplicate skills', async () => {
    const findSkill = vi.spyOn(interestsRepository, 'findSkill');
    findSkill.mockResolvedValueOnce(null);
    expect((await request(createApp()).post('/api/v1/profile/interests').send({ skillId: 'missing' })).status).toBe(404);

    findSkill.mockResolvedValueOnce({ id: 'skill_2', title: 'Old skill', description: null, isActive: false, category: null } as never);
    expect((await request(createApp()).post('/api/v1/profile/interests').send({ skillId: 'skill_2' })).status).toBe(409);

    findSkill.mockResolvedValueOnce({ id: 'skill_3', title: 'Spanish', description: null, isActive: true, category: null } as never);
    vi.spyOn(interestsRepository, 'findByUserAndSkill').mockResolvedValue({ id: 'interest_3' } as never);
    expect((await request(createApp()).post('/api/v1/profile/interests').send({ skillId: 'skill_3' })).status).toBe(409);
  });

  it('removes only the authenticated user interest', async () => {
    const remove = vi.spyOn(interestsRepository, 'deleteByUserAndSkill').mockResolvedValue({} as never);

    const response = await request(createApp()).delete('/api/v1/profile/interests/skill_1');

    expect(response.status).toBe(204);
    expect(remove).toHaveBeenCalledWith('user_1', 'skill_1');
  });

  it('rejects malformed interest payloads', async () => {
    const response = await request(createApp()).post('/api/v1/profile/interests').send({ skillId: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
