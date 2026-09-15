import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { logger } from './utils/logger';
import { isRateLimitingDisabled } from './middleware/rateLimiter';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Backend server running on port ${PORT}`);

  if (isRateLimitingDisabled) {
    logger.warn(
      '\n╔════════════════════════════════════════════════════════════════════╗\n' +
      '║  [WARNING] RATE LIMITING IS GLOBALLY DISABLED                     ║\n' +
      '║  (DISABLE_RATE_LIMITING=true)                                      ║\n' +
      '║  All login and API rate limiters are bypassed.                     ║\n' +
      '║  This setting must NEVER be enabled in any deployed environment!   ║\n' +
      '╚════════════════════════════════════════════════════════════════════╝'
    );
  }
});
