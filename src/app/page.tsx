// src/app/page.tsx

"use client"
import Image from 'next/image';
import { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';

const VerifyEmailPage = dynamic(() => import('./verifyemail/page'), {
  loading: () => <div>Loading...</div>
});

const Meteors = dynamic(() => import('@/components/ui/meteors').then(mod => mod.Meteors), {
  ssr: false
});

const AnimatedTestimonials = dynamic(
  () => import('@/components/images').then(mod => mod.AnimatedTestimonialsDemo),
  { ssr: false }
);

export default function HomePage() {
  const [showVerifyEmail] = useState(true);

  return (
    <div className="min-h-screen w-full p-4 md:p-6 flex items-center justify-center">
      <div className="w-full max-w-7xl relative">
        <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-blue-500 to-teal-500 transform scale-[0.80] rounded-full blur-3xl" />
        <div className="relative shadow-xl bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-xl">
          <Suspense fallback={<div>Loading meteors...</div>}>
            <Meteors number={20} />
          </Suspense>
          
          <div className="px-4 sm:px-6 py-4 md:py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left side - Testimonials */}
            <div className="lg:col-span-8 xl:col-span-9">
              <Suspense fallback={<div>Loading testimonials...</div>}>
                <AnimatedTestimonials />
              </Suspense>
            </div>
            
            {/* Right side - Verify Email */}
            <div className="lg:col-span-4 xl:col-span-3 flex items-center">
              {showVerifyEmail && (
                <Suspense fallback={<div>Loading verification...</div>}>
                  <div className="w-full">
                    <VerifyEmailPage />
                  </div>
                </Suspense>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}