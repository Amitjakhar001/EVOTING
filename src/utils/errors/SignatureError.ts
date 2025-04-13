// src/utils/errors/SignatureError.ts

export class SignatureError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly details?: any
    ) {
      super(message);
      this.name = 'SignatureError';
    }
  }
  
  export const SignatureErrorCodes = {
    INVALID_FORMAT: 'SIGNATURE_INVALID_FORMAT',
    VERIFICATION_FAILED: 'SIGNATURE_VERIFICATION_FAILED',
    MISSING_PARAMETERS: 'SIGNATURE_MISSING_PARAMETERS',
    SYSTEM_ERROR: 'SIGNATURE_SYSTEM_ERROR'
  } as const;