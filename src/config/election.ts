// src/config/election.ts file

// Define the allowed domain types
export type AllowedDomain = '@nitkkr.ac.in' | '@iitbhilai.ac.in' | '@gmail.com' ;

// Core election configuration 
export const ELECTION_CONFIG = {
  candidates: ["Btech 1st Year", "Btech 2nd Year", "Btech 3rd Year", "Btech 4th Year"],
  timing: {
    registrationDuration: 9*60, // seconds 
    submissionDuration: 9*60, // seconds  
    votingDuration: 9*60, // seconds  
    verificationCodeExpiry: 600, // 10 minutes in seconds
  },
  domains: {
    allowed: ['@nitkkr.ac.in', '@iitbhilai.ac.in','@gmail.com'] as Array<AllowedDomain>
  },
  crypto: {
    keySize: 2048,
    hashAlgorithm: 'sha256',
    signatureFormat: 'base64'
  }
} as const;