// src/app/api/sendEmail/route.ts

import { NextResponse } from "next/server";
import { sendVerificationCode, sendKeys } from "@/utils/emailUtils";
import { setVerificationCode, verifyCode } from "@/utils/redisClient";
import {
  checkRateLimit,
  VerificationType,
  getRemainingTime,
  getAttempts,
  resetRateLimit
} from "@/utils/rateLimitUtils";
import { isAdmin } from "@/config/admin";
import { getAllowedDomains } from "@/utils/blockchainUtils";
import { ELECTION_CONFIG, AllowedDomain } from "@/config/election";

async function isValidEmail(email: string): Promise<boolean> {
  // First check if it's an admin email
  if (isAdmin(email)) {
    return true;
  }

  // Extract domain with @ from email
  const domain = email.substring(email.indexOf('@')) as AllowedDomain;
  
  try {
    // Then check blockchain contract
    const contractDomains = await getAllowedDomains();
    if (contractDomains.includes(domain)) {
      return true;
    }
  } catch (error) {
    console.error("Error fetching contract domains:", error);
    // Fallback to local config if contract call fails
    if (ELECTION_CONFIG.domains.allowed.includes(domain)) {
      return true;
    }
  }

  return false;
}
 
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      type,
      verificationCode,
      keys,
      verificationType = "login",
    } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check and auto-reset for any stuck rate limits
    const remaining = await getRemainingTime(email, verificationType as VerificationType);
    const attempts = await getAttempts(email, verificationType as VerificationType);
    
    // If rate limit is stuck (remaining time is 0 but attempts are maxed)
    if (remaining <= 0 && attempts >= 3) {
      console.log(`Auto-resetting stuck rate limit for: ${email}`);
      await resetRateLimit(email, verificationType as VerificationType);
    }

    // Rest of your existing validation code...
    const isValid = await isValidEmail(email);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email. Please use an authorized email address." },
        { status: 400 }
      );
    }

    switch (type) {
      case "verify": {
        if (!verificationCode) {
          return NextResponse.json(
            {
              verified: false,
              error: "Verification code is required",
            },
            { status: 400 }
          );
        }

        const isValid = await verifyCode(email, verificationCode);

        return NextResponse.json({
          verified: isValid,
          message: isValid
            ? "Code verified successfully"
            : "Invalid verification code or code expired",
        });
      }

      case "keys": {
        if (!keys?.publicKey || !keys?.privateKey || !keys?.certificate) {
          return NextResponse.json(
            {
              error: "Invalid or incomplete key data",
              success: false,
            },
            { status: 400 }
          );
        }

        const keysEmailSuccess = await sendKeys(email, keys);

        if (!keysEmailSuccess) {
          return NextResponse.json(
            {
              error: "Failed to send keys email",
              success: false,
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          message: "Keys sent successfully",
          success: true,
        });
      }

      case 'verification': {
        const isAllowed = await checkRateLimit(
          email,
          verificationType as VerificationType
        );
        
        if (!isAllowed) {
          const remainingTime = await getRemainingTime(
            email,
            verificationType as VerificationType
          );
          return NextResponse.json({
            error: `Too many verification attempts. Please wait ${Math.ceil(
              remainingTime / 60
            )} minute(s) before trying again.`,
            remainingTime,
            success: false,
          }, { status: 429 });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();

        try {
          await setVerificationCode(email, code);
        } catch (error) {
          console.error("Redis storage error:", error);
          return NextResponse.json({
            error: "Failed to store verification code",
            success: false,
          }, { status: 500 });
        }

        const emailSuccess = await sendVerificationCode(
          email,
          code,
          verificationType
        );

        if (!emailSuccess) {
          return NextResponse.json({
            error: "Failed to send verification email",
            success: false,
          }, { status: 500 });
        }

        return NextResponse.json({
          message: "Verification code sent successfully",
          success: true,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid request type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}