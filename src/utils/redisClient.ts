// src/utils/redisClient.ts

import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

export const setVerificationCode = async (email: string, code: string) => {
  console.log(`Setting verification code for ${email}: ${code}`);
  await redis.set(`verification:${email}`, code, { ex: 600 }) // 10 minutes expiry
}

export const verifyCode = async (email: string, code: string) => {
  console.log(`Verifying code for ${email}. Provided: ${code}`);
  const storedCode = await redis.get(`verification:${email}`);
  console.log(`Stored code: ${storedCode}`);

  // Ensure string comparison
  const isValid = storedCode?.toString() === code.toString();
  
  if (isValid) {
    await redis.del(`verification:${email}`);
    return true;
  }
  return false;
}