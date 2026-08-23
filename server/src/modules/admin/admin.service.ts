import prisma from '../../infrastructure/database/prisma';

export const adminService = {
  getDashboardSummary: async () => {
    const [totalUsers, activeUsers, suspendedUsers, totalSkills, openReports, requestVolume, messageVolume] = await Promise.all([
      prisma.user.count(), prisma.user.count({ where: { status: 'ACTIVE' } }), prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.skill.count(), prisma.moderationReport.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
      prisma.skillExchangeRequest.count(), prisma.message.count(),
    ]);
    return { totalUsers, activeUsers, suspendedUsers, totalSkills, openReports, requestVolume, messageVolume };
  },
  listUsers: (search?: string) => prisma.user.findMany({
    where: search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100,
    select: { id: true, name: true, email: true, role: true, status: true, isRestricted: true, warningCount: true, emailVerified: true, createdAt: true },
  }),
  getUser: (id: string) => prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, status: true, isRestricted: true, warningCount: true, emailVerified: true, createdAt: true } }),
  activateUser: async (id: string, actorUserId: string) => prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: { status: 'ACTIVE', isRestricted: false }, select: { id: true, name: true, email: true, role: true, status: true, isRestricted: true, warningCount: true } });
    await tx.auditLog.create({ data: { actorUserId, action: 'ADMIN_USER_ACTIVATED', entityType: 'User', entityId: id, payload: { status: 'ACTIVE', isRestricted: false } } });
    return user;
  }),
  listCategories: () => prisma.skillCategory.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, description: true, createdAt: true } }),
};
