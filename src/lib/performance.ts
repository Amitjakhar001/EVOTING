// src/lib/performance.ts
import React from 'react';

export const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const memoizeComponent = <T extends object>(Component: React.ComponentType<T>) => {
  return React.memo(Component, (prevProps, nextProps) => {
    return JSON.stringify(prevProps) === JSON.stringify(nextProps);
  });
};

// Add type-safe event handler debouncing
export const debounceEventHandler = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>): void => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};




/*
You can now use these utilities in your components like this:
typescriptCopyimport { debounce, memoizeComponent, debounceEventHandler } from '@/lib/performance';

// For event handlers
const handleSearch = debounceEventHandler((searchTerm: string) => {
  // Your search logic here
}, 300);

// For component memoization
const MemoizedComponent = memoizeComponent(YourComponent);
These optimizations should help with performance while maintaining type safety. Let me know if you need any clarification or have questions about implementing these changes! CopyRetryClaude does not have the ability to run the code it generates yet.Mhey what do you mean by that
domains: ['localhost'], // Add any image domains you're usingand tell me in production also what things i need to remember and need to changeand tell me how and where and why that performance file we createdEditLet me explain each part:

Image Domains in next.config.ts:

typescriptCopyimages: {
  domains: ['localhost'], // Development
  domains: ['your-production-domain.com'], // Production
}
This tells Next.js which domains are allowed to serve images. For example:

In development: If you have images like <Image src="http://localhost:3000/image.jpg" />
In production: If you have images from <Image src="https://your-domain.com/image.jpg" />


For Production Setup:

typescriptCopy// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@acertinity/ui']
  },
  images: {
    domains: ['your-production-domain.com'], // Your actual domain
  },
  // Production optimizations
  output: 'standalone', // For better Docker support
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable compression
  // Add env variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    // Add other env variables
  }
};

export default nextConfig;

The Performance File (/src/lib/performance.ts):

Why we created it:

To optimize heavy operations in your components
To prevent unnecessary re-renders
To improve application responsiveness

Where to use it:
typescriptCopy// Example in your verifyemail/page.tsx
import { debounceEventHandler } from '@/lib/performance';

export default function VerifyEmailPage() {
  // Debounce email input to prevent too many state updates
  const handleEmailChange = debounceEventHandler((value: string) => {
    setEmail(value);
  }, 300);

  return (
    <input
      type="email"
      onChange={(e) => handleEmailChange(e.target.value)}
      // ...rest of your code
    />
  );
}

Production Checklist:

Environment Variables:
bashCopy# .env.production
NEXT_PUBLIC_API_URL=https://your-api.com
# Add other production environment variables
Build and Deploy:
bashCopy# Build command
npm run build

# Start production server
npm run start

Performance Optimizations:

typescriptCopy// src/lib/performance.ts example usage
import { debounce, memoizeComponent } from '@/lib/performance';

// In your components:
const handleSearch = debounce(() => {
  // Expensive operation
}, 300);

// Memoize heavy components
const HeavyComponent = memoizeComponent(YourComponent);
Real-world example with your code:
typescriptCopy// verifyemail/page.tsx
"use client";
import { debounceEventHandler } from '@/lib/performance';

export default function VerifyEmailPage() {
  // Debounce email verification
  const debouncedVerify = debounceEventHandler(async (code: string) => {
    try {
      const response = await fetch("/api/sendEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "verify", verificationCode: code }),
      });
      // Rest of your verification logic
    } catch (error) {
      console.error(error);
    }
  }, 500);

  return (
    // Your component JSX
    <input
      type="text"
      onChange={(e) => debouncedVerify(e.target.value)}
      // ...
    />
  );
}

Production Environment Considerations:


Set up proper error logging (like Sentry)
Configure CORS properly
Enable caching
Set up proper security headers

Example security headers:
typescriptCopy// next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ]
      }
    ]
  }
};
The performance file helps optimize:

Form inputs (debouncing)
API calls (preventing rapid requests)
Heavy computations
Component rendering
Event handler performance*/