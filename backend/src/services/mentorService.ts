import prisma from '../utils/prisma';
import logger from '../utils/logger';

export class MentorService {
  /**
   * Selects the least-loaded active mentor in a department pool (round-robin / least-currently-assigned).
   * Atomically increments the mentor's currentMenteeCount.
   * If no active mentors exist in the pool, returns null.
   */
  async assignLeastLoadedMentor(
    departmentId: string,
    companyId: string
  ): Promise<string | null> {
    const mentors = await prisma.mentor.findMany({
      where: {
        companyId,
        departmentId,
        isActive: true,
      },
      orderBy: [
        { currentMenteeCount: 'asc' },
        { id: 'asc' },
      ],
      take: 1,
    });

    if (mentors.length === 0) {
      logger.info({ departmentId, companyId }, 'No active mentors found in department pool');
      return null;
    }

    const selectedMentor = mentors[0];

    // Atomically increment currentMenteeCount
    await prisma.mentor.update({
      where: { id: selectedMentor.id },
      data: {
        currentMenteeCount: { increment: 1 },
      },
    });

    logger.info(
      { mentorId: selectedMentor.id, departmentId, currentMenteeCount: selectedMentor.currentMenteeCount + 1 },
      'Assigned least-loaded mentor to employee'
    );

    return selectedMentor.id;
  }
}

export const mentorService = new MentorService();
export default mentorService;
