// src/app/api/response/verify-signatures/route.ts

import { NextRequest, NextResponse } from "next/server";
import { CryptoUtils } from "@/utils/cryptoUtils";
import { ec as EC } from "elliptic";
import BN from "bn.js";

const ec = new EC("secp256k1");

interface DecodedPublicKey {
  x: BN;
  y: BN;
}

interface RequestBody {
  publicKeys: string[];
  signature: string;
  keyImage: string;
  message: string;
  caseId: string;
}

export async function POST(req: NextRequest) {
  let requestBody: RequestBody | null = null;

  try {
    requestBody = await validateRequestBody(req);
    const decodedPublicKeys = await decodePublicKeys(requestBody.publicKeys);
    const signatureBuffer = Buffer.from(requestBody.signature, "base64");
    const keyImageHex = requestBody.keyImage;

    if (keyImageHex.length !== 128) {
      throw new Error("Invalid key image format");
    }

    let keyImageX, keyImageY;
    try {
      keyImageX = new BN(keyImageHex.slice(0, 64), 16);
      keyImageY = new BN(keyImageHex.slice(64, 128), 16);
    } catch (error) {
      throw new Error("Invalid key image format");
    }

    if (!keyImageX || !keyImageY) {
      throw new Error("Invalid key image coordinates");
    }

    const keyImage = {
      x: keyImageX,
      y: keyImageY,
    };

    const checksumLength = 32;

    if (signatureBuffer.length < checksumLength) {
      throw new Error("Signature data too short");
    }

    const checksum = new Uint8Array(signatureBuffer.slice(0, checksumLength));
    const sigCount = decodedPublicKeys.length;
    const signatureLength = (signatureBuffer.length - checksumLength) / sigCount;

    if (!Number.isInteger(signatureLength)) {
      throw new Error("Invalid signature format");
    }

    const signatures: Uint8Array[] = [];
    for (let i = 0; i < sigCount; i++) {
      const start = checksumLength + i * signatureLength;
      const end = start + signatureLength;
      signatures.push(new Uint8Array(signatureBuffer.slice(start, end)));
    }

    const ringSignature = {
      keyImage,
      checksum,
      signatures,
    };

    const isValid = await CryptoUtils.verifyRingSignature(
      Buffer.from(requestBody.message),
      decodedPublicKeys,
      ringSignature,
      Buffer.from(requestBody.caseId)
    );

    return NextResponse.json({ isValid });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to verify signature" },
      { status: 500 }
    );
  }
}

async function validateRequestBody(req: NextRequest): Promise<RequestBody> {
  const body = await req.json();

  if (!body.publicKeys || !Array.isArray(body.publicKeys)) {
    throw new Error("validation failed: publicKeys must be an array");
  }
  if (body.publicKeys.length < 2) {
    throw new Error("validation failed: at least 2 public keys are required");
  }
  if (!body.signature)
    throw new Error("validation failed: signature is required");
  if (!body.keyImage)
    throw new Error("validation failed: keyImage is required");
  if (!body.message) throw new Error("validation failed: message is required");
  if (!body.caseId) throw new Error("validation failed: caseId is required");

  return body as RequestBody;
}

async function decodePublicKeys(
  publicKeys: string[]
): Promise<DecodedPublicKey[]> {
  return Promise.all(
    publicKeys.map(async (pk) => {
      try {
        const decoded = Buffer.from(pk, "base64").toString();
        const keyHex = extractKeyFromPEM(decoded);

        if (keyHex.length !== 128) {
          throw new Error(`Invalid key hex length: ${keyHex.length}`);
        }

        const x = keyHex.slice(0, 64);
        const y = keyHex.slice(64);

        return {
          x: new BN(x, 16),
          y: new BN(y, 16),
        };
      } catch (error) {
        throw new Error("Failed to decode public key");
      }
    })
  );
}

function extractKeyFromPEM(pem: string): string {
  const matches = pem.match(
    /-----BEGIN (?:PUBLIC|PRIVATE) KEY-----\n([A-Za-z0-9+/=\n]+)\n-----END (?:PUBLIC|PRIVATE) KEY-----/
  );
  if (!matches || !matches[1]) {
    throw new Error("Invalid PEM format");
  }

  const keyBase64 = matches[1].replace(/\n/g, "");
  return Buffer.from(keyBase64, "base64").toString("hex");
}