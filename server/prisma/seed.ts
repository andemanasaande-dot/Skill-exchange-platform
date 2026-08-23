import { PrismaClient, InterestType, NotificationType, RequestStatus, UserRole, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

const categorySeed = [
  { name: 'Programming', slug: 'programming', description: 'Software development, scripting, and technical learning.' },
  { name: 'Music', slug: 'music', description: 'Instrumental, vocal, and music theory skills.' },
  { name: 'Languages', slug: 'languages', description: 'Language learning and conversation practice.' },
  { name: 'Art', slug: 'art', description: 'Creative drawing, painting, and visual arts.' },
  { name: 'Sports', slug: 'sports', description: 'Fitness, movement, and athletic skills.' },
  { name: 'Cooking', slug: 'cooking', description: 'Culinary techniques and kitchen skills.' },
  { name: 'Photography', slug: 'photography', description: 'Photo composition, editing, and visual storytelling.' },
  { name: 'Design', slug: 'design', description: 'Product, UI, and visual design workflows.' },
  { name: 'Business', slug: 'business', description: 'Operations, strategy, and commercial thinking.' },
  { name: 'Marketing', slug: 'marketing', description: 'Branding, advocacy, and audience growth skills.' },
] as const;

const skillMap: Record<string, string[]> = {
  Programming: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'SQL'],
  Music: ['Guitar', 'Piano', 'Singing', 'Music Theory', 'Drums'],
  Languages: ['English Conversation', 'Spanish', 'Japanese', 'French', 'Arabic'],
  Art: ['Drawing', 'Watercolor', 'Digital Illustration', 'Pottery', 'Calligraphy'],
  Sports: ['Yoga', 'Strength Training', 'Basketball', 'Tennis', 'Running'],
  Cooking: ['Pasta Making', 'Baking', 'Meal Prep', 'Sushi', 'Vegan Cooking'],
  Photography: ['Portrait Photography', 'Product Photography', 'Photo Editing', 'Lighting', 'Drone Photography'],
  Design: ['UI/UX Design', 'Branding', 'Figma', 'Motion Design', 'Typography'],
  Business: ['Strategy', 'Market Research', 'Excel', 'Sales', 'Pitch Coaching'],
  Marketing: ['SEO', 'Content Marketing', 'Social Media', 'Email Campaigns', 'Copywriting'],
};

async function main() {
  const users = await prisma.user.createMany({
    data: [
      {
        email: 'alex.demo@example.com',
        passwordHash: 'seed-placeholder-password-not-used',
        name: 'Alex Demo',
        bio: 'Product-focused learner who enjoys sharing technical skills.',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
      {
        email: 'maya.demo@example.com',
        passwordHash: 'seed-placeholder-password-not-used',
        name: 'Maya Demo',
        bio: 'Creative professional exploring art and design learning exchanges.',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
      {
        email: 'sam.demo@example.com',
        passwordHash: 'seed-placeholder-password-not-used',
        name: 'Sam Demo',
        bio: 'Cooking and photography enthusiast sharing practical skills.',
        role: UserRole.MODERATOR,
        status: UserStatus.ACTIVE,
      },
    ],
  });

  const createdUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  for (const category of categorySeed) {
    await prisma.skillCategory.upsert({
      where: { slug: category.slug },
      update: {
        description: category.description,
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
    });
  }

  const categories = await prisma.skillCategory.findMany({
    select: { id: true, name: true },
  });

  const categoryByName = new Map(categories.map((category) => [category.name, category.id]));

  for (const [categoryName, skillTitles] of Object.entries(skillMap)) {
    const categoryId = categoryByName.get(categoryName);
    if (!categoryId) continue;

    for (const [index, title] of skillTitles.entries()) {
      const owner = createdUsers[index % createdUsers.length];

      await prisma.skill.upsert({
        where: {
          userId_title: { userId: owner.id, title },
        },
        update: {
          categoryId,
          description: `Sample ${title.toLowerCase()} skill for the ${categoryName.toLowerCase()} category.`,
          isActive: true,
        },
        create: {
          userId: owner.id,
          categoryId,
          title,
          description: `Sample ${title.toLowerCase()} skill for the ${categoryName.toLowerCase()} category.`,
          isActive: true,
        },
      });

      const createdSkill = await prisma.skill.findFirst({
        where: { userId: owner.id, title },
        select: { id: true },
      });

      if (!createdSkill) continue;

      await prisma.userSkillInterest.upsert({
        where: {
          userId_skillId_interestType: {
            userId: owner.id,
            skillId: createdSkill.id,
            interestType: InterestType.LEARN,
          },
        },
        update: {},
        create: {
          userId: owner.id,
          skillId: createdSkill.id,
          interestType: InterestType.LEARN,
        },
      });
    }
  }

  const demoUser = await prisma.user.findFirst({ where: { email: 'alex.demo@example.com' }, select: { id: true } });
  const partnerUser = await prisma.user.findFirst({ where: { email: 'maya.demo@example.com' }, select: { id: true } });

  if (demoUser && partnerUser) {
    const sampleSkill = await prisma.skill.findFirst({ where: { userId: partnerUser.id }, select: { id: true } });

    if (sampleSkill) {
      await prisma.skillExchangeRequest.upsert({
        where: {
          senderId_receiverId_skillId: {
            senderId: demoUser.id,
            receiverId: partnerUser.id,
            skillId: sampleSkill.id,
          },
        },
        update: {
          status: RequestStatus.PENDING,
          message: 'I would like to learn this skill from you.',
        },
        create: {
          senderId: demoUser.id,
          receiverId: partnerUser.id,
          skillId: sampleSkill.id,
          status: RequestStatus.PENDING,
          message: 'I would like to learn this skill from you.',
        },
      });
    }
  }

  const recipient = await prisma.user.findFirst({ where: { email: 'maya.demo@example.com' }, select: { id: true } });
  if (recipient) {
    await prisma.notification.createMany({
      data: [
        {
          recipientId: recipient.id,
          type: NotificationType.REQUEST_CREATED,
          title: 'New skill exchange request',
          body: 'Someone requested to learn from you.',
        },
        {
          recipientId: recipient.id,
          type: NotificationType.NEW_MESSAGE,
          title: 'New message',
          body: 'Your conversation has a new message.',
        },
      ],
    });
  }
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
