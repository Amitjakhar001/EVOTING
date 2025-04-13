// src/utils/keyGenerationUtils.ts
 
import { ethers } from 'ethers';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  address: string;
}

export async function generateKeys(): Promise<KeyPair> {
  try {
    // Generate Ethereum-style key pair
    const wallet = ethers.Wallet.createRandom();
    
    const keys: KeyPair = {
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      address: wallet.address
    };
    
     
      console.group('Generated Key Pair Details:');
      // console.log('Address:', keys.address);
      console.log('Public Key:', keys.publicKey);
      console.log('Private Key:', keys.privateKey);
      console.groupEnd();
    
    
    return keys;
  } catch (error) {
    console.error('Error generating keys:', error);
    throw error;
  }
}