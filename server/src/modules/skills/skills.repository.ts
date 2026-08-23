import prisma from '../../infrastructure/database/prisma';
import type { SkillDiscoveryQuery } from './skills.discovery.validation';

export const skillsRepository = {
  list: async (query: SkillDiscoveryQuery) => {
    const where = {
      isActive: query.active,
      ...(query.owner ? { userId: query.owner } : {}),
      ...(query.skill ? { title: { contains: query.skill, mode: 'insensitive' as const } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.category
        ? {
            category: {
              OR: [{ id: query.category }, { slug: query.category }],
            },
          }
        : {}),
    };

    const orderBy = query.sort === 'oldest'
      ? [{ createdAt: 'asc' as const }, { id: 'asc' as const }]
      : query.sort === 'title_asc' || query.sort === 'title'
        ? [{ title: 'asc' as const }, { id: 'asc' as const }]
        : query.sort === 'title_desc'
          ? [{ title: 'desc' as const }, { id: 'asc' as const }]
          : [{ createdAt: 'desc' as const }, { id: 'asc' as const }];

    const [total, skills] = await prisma.$transaction([
      prisma.skill.count({ where }),
      prisma.skill.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          title: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          owner: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return { skills, total };
  },
  getById: async (_id: string) => {
    return prisma.skill.findUnique({ where: { id: _id }, select: { id: true, userId: true, categoryId: true, title: true, description: true, isActive: true, createdAt: true, updatedAt: true } });
  },
  create: async (payload: { userId: string; title: string; categoryId: string; description?: string; isActive?: boolean }) => prisma.skill.create({ data: payload, select: { id: true, userId: true, categoryId: true, title: true, description: true, isActive: true, createdAt: true, updatedAt: true } }),
  update: async (id: string, payload: { title?: string; categoryId?: string; description?: string; isActive?: boolean }) => prisma.skill.update({ where: { id }, data: payload, select: { id: true, userId: true, categoryId: true, title: true, description: true, isActive: true, createdAt: true, updatedAt: true } }),
  delete: async (id: string) => prisma.skill.delete({ where: { id } }),
};
