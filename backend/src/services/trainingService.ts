import prisma from '../utils/prisma';
import {
  CreateTrainingEntryInput,
  UpdateTrainingEntryInput,
  TrainingListQueryInput,
  extractYouTubeVideoId,
} from '../utils/validation';

export interface FormattedTrainingEntry {
  id: string;
  companyId: string;
  title: string;
  description: string;
  contentType: 'video' | 'guide';
  type: 'video' | 'guide';
  youtubeVideoId: string | null;
  embedUrl: string | null;
  guideContent: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  creator?: {
    id: string;
    email: string;
    role: string;
  } | null;
}

export function formatTrainingEntry(entry: any): FormattedTrainingEntry {
  const embedUrl =
    entry.contentType === 'video' && entry.youtubeVideoId
      ? `https://www.youtube.com/embed/${entry.youtubeVideoId}`
      : null;

  return {
    id: entry.id,
    companyId: entry.companyId,
    title: entry.title,
    description: entry.description,
    contentType: entry.contentType as 'video' | 'guide',
    type: entry.contentType as 'video' | 'guide',
    youtubeVideoId: entry.youtubeVideoId,
    embedUrl,
    guideContent: entry.guideContent,
    createdBy: entry.createdBy,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    creator: entry.creator
      ? {
          id: entry.creator.id,
          email: entry.creator.email,
          role: entry.creator.role,
        }
      : null,
  };
}

export class TrainingService {
  /**
   * Create a new training entry (HR Admin only, scoped to company)
   */
  async createTrainingEntry(
    companyId: string,
    userId: string,
    data: CreateTrainingEntryInput
  ): Promise<FormattedTrainingEntry> {
    let youtubeVideoId: string | null = null;
    let guideContent: string | null = null;

    if (data.contentType === 'video') {
      if (!data.youtubeUrl) {
        throw new Error('youtubeUrl is required for video training entries');
      }
      const extraction = extractYouTubeVideoId(data.youtubeUrl);
      if (!extraction.success) {
        throw new Error(extraction.error);
      }
      youtubeVideoId = extraction.videoId;
    } else {
      if (!data.guideContent || data.guideContent.trim() === '') {
        throw new Error('guideContent is required for guide training entries');
      }
      guideContent = data.guideContent.trim();
    }

    const created = await prisma.trainingEntry.create({
      data: {
        companyId,
        title: data.title.trim(),
        description: data.description.trim(),
        contentType: data.contentType,
        youtubeVideoId,
        guideContent,
        createdBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return formatTrainingEntry(created);
  }

  /**
   * List training entries with search and pagination (scoped to company)
   */
  async listTrainingEntries(
    companyId: string,
    options: TrainingListQueryInput
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      companyId,
    };

    if (options.contentType) {
      where.contentType = options.contentType;
    }

    if (options.search && options.search.trim()) {
      where.title = {
        contains: options.search.trim(),
        mode: 'insensitive',
      };
    }

    const [total, entries] = await Promise.all([
      prisma.trainingEntry.count({ where }),
      prisma.trainingEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: entries.map(formatTrainingEntry),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get single training entry by ID (scoped to company)
   */
  async getTrainingEntry(
    companyId: string,
    id: string
  ): Promise<FormattedTrainingEntry | null> {
    const entry = await prisma.trainingEntry.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!entry) return null;
    return formatTrainingEntry(entry);
  }

  /**
   * Update a training entry (HR Admin only, scoped to company)
   */
  async updateTrainingEntry(
    companyId: string,
    id: string,
    data: UpdateTrainingEntryInput
  ): Promise<FormattedTrainingEntry | null> {
    const existing = await prisma.trainingEntry.findFirst({
      where: { id, companyId },
    });

    if (!existing) return null;

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description.trim();

    const targetType = data.contentType || existing.contentType;
    if (data.contentType !== undefined) {
      updateData.contentType = data.contentType;
    }

    if (targetType === 'video') {
      if (data.youtubeUrl !== undefined) {
        if (!data.youtubeUrl) {
          throw new Error('youtubeUrl is required for video training entries');
        }
        const extraction = extractYouTubeVideoId(data.youtubeUrl);
        if (!extraction.success) {
          throw new Error(extraction.error);
        }
        updateData.youtubeVideoId = extraction.videoId;
        updateData.guideContent = null;
      }
    } else if (targetType === 'guide') {
      if (data.guideContent !== undefined) {
        if (!data.guideContent || data.guideContent.trim() === '') {
          throw new Error('guideContent cannot be empty');
        }
        updateData.guideContent = data.guideContent.trim();
        updateData.youtubeVideoId = null;
      }
    }

    const updated = await prisma.trainingEntry.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return formatTrainingEntry(updated);
  }

  /**
   * Delete a training entry (HR Admin only, scoped to company)
   */
  async deleteTrainingEntry(
    companyId: string,
    id: string
  ): Promise<boolean> {
    const existing = await prisma.trainingEntry.findFirst({
      where: { id, companyId },
    });

    if (!existing) return false;

    await prisma.trainingEntry.delete({
      where: { id },
    });

    return true;
  }
}

export const trainingService = new TrainingService();
export default trainingService;
