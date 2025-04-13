//src/utils/rateLimitUtils.ts

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

export enum VerificationType {
  LOGIN = 'login',
  GENERATION = 'generation',
  DEPLOY = 'deploy'   
}

const RATE_LIMIT_CONFIG = {
  [VerificationType.LOGIN]: {
    duration: 60, // 1 minute
    maxAttempts: 2
  },
  [VerificationType.GENERATION]: {
    duration: 60, // 1 minute
    maxAttempts: 2
  },
  [VerificationType.DEPLOY]: {
    duration: 60,  
    maxAttempts: 2  
  }
};

export const checkRateLimit = async (email: string, type: VerificationType): Promise<boolean> => {
  const key = `rateLimit:${type}:${email}`;
  
  try {
    // First check if there's a stuck rate limit
    const remaining = await redis.ttl(key);
    const attempts = await redis.get<string>(key);
    
    // Auto-reset if stuck (time expired but attempts still exist)
    if (remaining <= 0 && attempts !== null) {
      console.log(`Auto-resetting expired rate limit for ${email}`);
      await redis.del(key);
      return true;
    }
    
    // If key doesn't exist, set initial attempts
    if (attempts === null) {
      await redis.setex(key, RATE_LIMIT_CONFIG[type].duration, '1');
      return true;
    }
    
    // Increment attempts
    const currentAttempts = parseInt(attempts);
    if (currentAttempts >= RATE_LIMIT_CONFIG[type].maxAttempts) {
      return false;
    }
    
    // Increment counter but maintain existing TTL
    await redis.incr(key);
    return true;
  } catch (error) {
    console.error('Rate limit check error:', error);
    // If Redis fails, allow the request
    return true;
  }
};

export const getRemainingTime = async (email: string, type: VerificationType): Promise<number> => {
  const key = `rateLimit:${type}:${email}`;
  const ttl = await redis.ttl(key);
  return ttl > 0 ? ttl : 0;
};

export const getAttempts = async (email: string, type: VerificationType): Promise<number> => {
  const key = `rateLimit:${type}:${email}`;
  const attempts = await redis.get<string>(key);
  return attempts ? parseInt(attempts) : 0;
};

export const resetRateLimit = async (email: string, type: VerificationType): Promise<void> => {
  const key = `rateLimit:${type}:${email}`;
  await redis.del(key);
};