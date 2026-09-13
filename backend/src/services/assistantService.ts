/**
 * Assistant Service (Qorra Orchestrator).
 *
 * Implements Phase 4 RAG generation logic:
 * 1. Retrieves relevant document chunks scoped strictly to the user's company_id.
 * 2. Short-circuits with a defined fallback ("I couldn't find this in company documents — please contact HR")
 *    if similarity scores are below the threshold or no chunks are returned — WITHOUT calling Groq.
 * 3. If grounded, delegates prompt assembly and generation to GroqService.
 * 4. Strictly read-only; no database mutations or tool invocations.
 */

import documentService from './documentService';
import groqService, { GenerationResult } from './groqService';
import logger from '../utils/logger';

// Named, easily adjustable constant for retrieval grounding threshold
export const DEFAULT_SIMILARITY_THRESHOLD = 0.50;

export const NOT_FOUND_FALLBACK_MESSAGE =
  "I couldn't find this in company documents — please contact HR";

export interface AskQuestionParams {
  companyId: string;
  question: string;
  topK?: number;
}

export class AssistantService {
  private similarityThreshold: number;

  constructor(threshold?: number) {
    const envThreshold = process.env.ASSISTANT_SIMILARITY_THRESHOLD
      ? parseFloat(process.env.ASSISTANT_SIMILARITY_THRESHOLD)
      : undefined;
    this.similarityThreshold = threshold ?? envThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  }

  getThreshold(): number {
    return this.similarityThreshold;
  }

  /**
   * Process a user question using grounded RAG retrieval + generation.
   */
  async askQuestion(params: AskQuestionParams): Promise<GenerationResult> {
    const { companyId, question, topK = 4 } = params;
    const trimmedQuestion = question.trim();

    logger.info(
      { companyId, questionLength: trimmedQuestion.length, threshold: this.similarityThreshold },
      'Processing assistant question via RAG'
    );

    // 1. Retrieve top-k chunks using Phase 3's verified pgvector similarity search
    const retrievedChunks = await documentService.retrieveSimilarChunks(
      companyId,
      trimmedQuestion,
      topK
    );

    // 2. Fallback check: Filter for chunks meeting or exceeding the threshold
    const topChunk = retrievedChunks[0];
    const isGrounded = topChunk && topChunk.similarity >= this.similarityThreshold;

    if (!isGrounded) {
      logger.info(
        {
          companyId,
          topSimilarity: topChunk?.similarity ?? 0,
          threshold: this.similarityThreshold,
        },
        'Retrieval similarity below threshold or no chunks found. Short-circuiting without Groq call.'
      );

      return {
        answer: NOT_FOUND_FALLBACK_MESSAGE,
        sources: [],
        isFallback: true,
      };
    }

    // Filter to all chunks that meet the threshold for context window efficiency
    const groundedChunks = retrievedChunks
      .filter((c) => c.similarity >= this.similarityThreshold)
      .map((c) => ({
        content: c.content,
        documentFilename: c.documentFilename,
        similarity: c.similarity,
      }));

    logger.info(
      {
        companyId,
        groundedChunkCount: groundedChunks.length,
        topSimilarity: topChunk.similarity,
      },
      'Sufficient grounding found. Proceeding to Groq generation.'
    );

    // 3. Generate answer using Groq with fixed grounding system prompt
    return await groqService.generateAnswer(trimmedQuestion, groundedChunks);
  }
}

export default new AssistantService();
