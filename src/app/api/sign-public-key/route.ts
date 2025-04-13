// src/app/api/sign-public-key/route.ts

import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { SignatureError, SignatureErrorCodes } from '@/utils/errors/SignatureError';

export async function POST(request: Request) {
  try {
    // console.log('🔑 Starting signature generation process');
    const { email, publicKey } = await request.json();
    
    // console.log('📧 Email:', email);
    // console.log('🔐 Public Key Length:', publicKey.length);
    
    if (!email || !publicKey) {
      throw new SignatureError(
        'Missing email or public key',
        SignatureErrorCodes.MISSING_PARAMETERS
      );
    }

    const eaPrivateKey = process.env.ELECTION_AUTHORITY_PRIVATE_KEY;
    // const eaAddress = process.env.ELECTION_AUTHORITY_ADDRESS;
    
    if (!eaPrivateKey) {
      throw new SignatureError(
        'Election Authority credentials not configured',
        SignatureErrorCodes.SYSTEM_ERROR
      );
    }

    // if ( !eaAddress) {
    //   throw new SignatureError(
    //     'Election Authority credentials not configured',
    //     SignatureErrorCodes.SYSTEM_ERROR
    //   );
    // }

    // console.log('👛 Wallet Address:', eaAddress);

    try {
      // Create message hash
      // console.log('📝 Creating message hash...');
      const messageHash = ethers.solidityPackedKeccak256(
        ["string", "string"],
        [email, publicKey]
      );
      // console.log('📜 Message Hash:', messageHash);
      const wallet = new ethers.Wallet(eaPrivateKey);
      const signature = await wallet.signMessage(ethers.getBytes(messageHash));
      // console.log('✍️ Raw Signature:', signature);
      // console.log('📏 Signature Length:', signature.length);

      // Verify signature locally before sending
      // console.log('🔍 Starting local signature verification...');
      
      // Recover the signer's address from the signature
      // const recoveredAddress = ethers.verifyMessage(
      //   ethers.getBytes(messageHash),
      //   signature
      // );
      
      // console.log('🔍 Recovered Address:', recoveredAddress);
      // console.log('🎯 Expected Address:', eaAddress);
      // console.log('✅ Matches Wallet Address:', recoveredAddress.toLowerCase() === eaAddress.toLowerCase());

      // if (recoveredAddress.toLowerCase() !== eaAddress.toLowerCase()) {
      //   throw new SignatureError(
      //     'Local signature verification failed',
      //     SignatureErrorCodes.VERIFICATION_FAILED,
      //     'Recovered address does not match Election Authority address'
      //   );
      // }

      if (signature.length !== 132) { // 0x + 130 chars
        throw new SignatureError(
          'Generated signature has invalid length',
          SignatureErrorCodes.INVALID_FORMAT
        );
      }

      // Additional debug info for the signature
      // const sig = ethers.Signature.from(signature);
      // console.log('📊 Signature Components:', {
      //   r: sig.r,
      //   s: sig.s,
      //   v: sig.v,
      //   normalized: sig.serialized
      // });

      return NextResponse.json({ signature });

    } catch (error) {
      console.error('❌ Signature generation error:', error);
      if (error instanceof SignatureError) throw error;
      
      throw new SignatureError(
        'Failed to generate signature',
        SignatureErrorCodes.SYSTEM_ERROR,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

  } catch (error) {
    console.error('🚫 API error:', error);
    
    if (error instanceof SignatureError) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to process signature request',
      code: SignatureErrorCodes.SYSTEM_ERROR,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}