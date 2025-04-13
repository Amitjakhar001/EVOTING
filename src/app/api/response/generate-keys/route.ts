// src/app/api/response/generate-keys/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { CryptoUtils, ECPoint } from '@/utils/cryptoUtils';
import BN from 'bn.js';

// Helper function to ensure point coordinates are properly formatted
function formatPoint(point: ECPoint): string {
  const xHex = point.x.toString(16).padStart(64, '0');
  const yHex = point.y.toString(16).padStart(64, '0');
  return xHex + yHex;
}

// Convert key components to PEM format
function convertToPEM(keyPair: { privateKey: BN, publicKey: ECPoint }, isPrivate: boolean): string {
  const type = isPrivate ? 'PRIVATE' : 'PUBLIC';
  let keyHex: string;

  if (isPrivate) {
    keyHex = keyPair.privateKey.toString(16).padStart(64, '0');
  } else {
    keyHex = formatPoint(keyPair.publicKey);
  }

  // Ensure the hex string has even length
  if (keyHex.length % 2 !== 0) {
    keyHex = '0' + keyHex;
  }

  // Convert to Base64 with proper line breaks
  const keyBase64 = Buffer.from(keyHex, 'hex').toString('base64');
  const formattedKey = keyBase64.match(/.{1,64}/g)?.join('\n') || keyBase64;

  return `-----BEGIN ${type} KEY-----\n${formattedKey}\n-----END ${type} KEY-----`;
}

export async function POST(req: NextRequest) {
  console.log('🚀 Generate Keys API Request received');
  
  try {
    console.log('⚙️ Starting key generation process');
    const keyPair = await CryptoUtils.generateKeyPair();
    
    // Validate that we have both keys
    if (!keyPair.privateKey || !keyPair.publicKey?.x || !keyPair.publicKey?.y) {
      throw new Error('Invalid key pair generated');
    }

    // Convert keys to PEM format
    const privateKeyPEM = convertToPEM(keyPair, true);
    const publicKeyPEM = convertToPEM(keyPair, false);
    
    // Calculate coordinates string
    const coordinates = formatPoint(keyPair.publicKey);
    
    // Calculate digest from public key
    const digest = CryptoUtils.utils.bufferToBN(
      Buffer.from(formatPoint(keyPair.publicKey), 'hex')
    ).toString(16);

    const response = {
      publicKey: Buffer.from(publicKeyPEM).toString('base64'),
      privateKey: Buffer.from(privateKeyPEM).toString('base64'),
      status: 'success',
      digest,
      keyCoordinate: coordinates
    };

    console.log('✅ Keys generated successfully');
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Key generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate keys',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}