// src/app/api/response/sign-vote/route.ts

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
  privateKey: string;
  publicKeys: string[];
  message: string;
  caseId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await validateRequestBody(req);

    const decodedPrivateKey = Buffer.from(body.privateKey, "base64").toString();
    const privateKeyHex = extractKeyFromPEM(decodedPrivateKey);
    const privateKeyBN = new BN(privateKeyHex, 16);

    const keyPair = ec.keyFromPrivate(privateKeyHex, "hex");
    const signerPubKey = keyPair.getPublic();

    const decodedPublicKeys = await decodePublicKeys(body.publicKeys);
    const signerIndex = findSignerIndex(signerPubKey, decodedPublicKeys);

    if (signerIndex === -1) {
      return NextResponse.json(
        { error: "Private key does not match any public key" },
        { status: 400 }
      );
    }

    const messageBuffer = Buffer.from(body.message);
    const caseIdBuffer = Buffer.from(body.caseId);

    const signature = await CryptoUtils.createRingSignature(
      messageBuffer,
      decodedPublicKeys,
      privateKeyBN,
      signerIndex,
      caseIdBuffer
    );
    
    if (!signature || !signature.keyImage) {
      throw new Error("Invalid signature: Missing key image");
    }
    
    const keyImageXHex = signature.keyImage.x.toString(16).padStart(64, '0');
    const keyImageYHex = signature.keyImage.y.toString(16).padStart(64, '0');
    const keyImageX = new BN(keyImageXHex, 16);
    const keyImageY = new BN(keyImageYHex, 16);

    if (!keyImageX || !keyImageY) {
      throw new Error("Invalid key image coordinates");
    }

    const keyImageHex = keyImageXHex + keyImageYHex;

    const signatureBytes = Buffer.concat([
      Buffer.from(signature.checksum),
      ...signature.signatures.map((s) => Buffer.from(s)),
    ]);

    const response = {
      signature: signatureBytes.toString("base64"),
      keyImage: keyImageHex,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Invalid PEM")) {
        return NextResponse.json(
          { error: "Invalid key format" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create signature" },
      { status: 500 }
    );
  }
}

async function validateRequestBody(req: NextRequest): Promise<RequestBody> {
  const body = await req.json();

  if (!body.privateKey)
    throw new Error("validation failed: privateKey is required");
  if (!body.publicKeys || !Array.isArray(body.publicKeys)) {
    throw new Error("validation failed: publicKeys must be an array");
  }
  if (body.publicKeys.length < 2) {
    throw new Error("validation failed: at least 2 public keys are required");
  }
  if (!body.message) throw new Error("validation failed: message is required");
  if (!body.caseId) throw new Error("validation failed: caseId is required");

  return body as RequestBody;
}

function extractKeyFromPEM(pem: string): string {
    const matches = pem.match(/-----BEGIN (?:PUBLIC|PRIVATE) KEY-----\n([A-Za-z0-9+/=\n]+)\n-----END (?:PUBLIC|PRIVATE) KEY-----/);
    if (!matches || !matches[1]) {
        throw new Error('Invalid PEM format');
    }
    
    const keyBase64 = matches[1].replace(/\n/g, '');
    return Buffer.from(keyBase64, 'base64').toString('hex');
}

async function decodePublicKeys(publicKeys: string[]): Promise<DecodedPublicKey[]> {
    return Promise.all(publicKeys.map(async (pk) => {
        try {
            const decoded = Buffer.from(pk, 'base64').toString();
            const keyHex = extractKeyFromPEM(decoded);
            
            if (keyHex.length !== 128) {
              throw new Error(`Invalid key hex length: ${keyHex.length}`);
            }
            
            const x = keyHex.slice(0, 64);
            const y = keyHex.slice(64);
            
            return {
                x: new BN(x, 16),
                y: new BN(y, 16)
            };
        } catch (error) {
            throw new Error('Failed to decode public key');
        }
    }));
}

function findSignerIndex(signerPubKey: any, decodedPublicKeys: DecodedPublicKey[]): number {
    const signerX = signerPubKey.getX().toString(16).padStart(64, '0');
    const signerY = signerPubKey.getY().toString(16).padStart(64, '0');
    
    return decodedPublicKeys.findIndex((pk: DecodedPublicKey) => {
        const pkX = pk.x.toString(16).padStart(64, '0');
        const pkY = pk.y.toString(16).padStart(64, '0');
        return pkX === signerX && pkY === signerY;
    });
}