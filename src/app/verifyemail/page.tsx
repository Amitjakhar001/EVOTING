// src/app/verifyemail/page.tsx  

"use client";
import { useState, Suspense,useEffect} from "react"
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import { Loading, ButtonLoading } from "@/components/ui/loading";

// Dynamically import Aceternity UI components
const FlipWords = dynamic(() => import("@/components/ui/flip-words").then(mod => mod.FlipWords), {
  ssr: false
});

const BackgroundGradient = dynamic(
  () => import("@/components/ui/background-gradient").then(mod => mod.BackgroundGradient),
  { ssr: false }
);

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [buttonDisabled, setButtonDisabled] = useState(true);
  const router = useRouter();
  const words = ["NoOne Know", "Who Voted","To Whom"];
 // Initial page loading effect
 useEffect(() => {
  const timer = setTimeout(() => setPageLoading(false), 2000);
  return () => clearTimeout(timer);
}, []);

// Email validation and button control
useEffect(() => {
  const isValidEmail = email.trim().length > 0 && email.includes('@');
  setButtonDisabled(!isValidEmail || loading);
}, [email, loading]);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (buttonDisabled) return;
  
  setLoading(true);
  setButtonDisabled(true);

  try {
    const response = await fetch("/api/sendEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        email, 
        type: "verification",
        verificationType: "login"
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error);
      return;
    }

    setSuccess(data.success);
    setError("");
  } catch (error) {
    console.error(error);
    setError("Failed to send verification code");
  } finally {
    setLoading(false);
    // Keep button disabled for 30 seconds to prevent spam
    setTimeout(() => setButtonDisabled(false), 30000);
  }
};

const handleVerify = async (e: React.FormEvent) => {
  e.preventDefault();
  if (loading || !verificationCode) return;

  setLoading(true);
  try {
    const response = await fetch("/api/sendEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, type: "verify", verificationCode }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error);
      return;
    }

    if (data.verified) {
      setSuccess(true);
      sessionStorage.setItem('isVerified', 'true');
      // Add loading effect before redirecting
      setPageLoading(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } else {
      setError(data.message);
    }
  } catch (error) {
    console.error(error);
    setError("Failed to verify code");
  } finally {
    setLoading(false);
  }
};

if (pageLoading) {
  return <Loading text="Loading..." className="h-full" />;
}


  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BackgroundGradient className="rounded-[22px] w-full max-w-md p-1">
        <div className="w-full">
          <div className="w-full max-w-md mx-auto">
            <div className="bg-black/20 backdrop-blur-lg rounded-xl p-4 shadow-xl border border-gray-800">
              <div className="text-center mb-6">
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-yellow-400 text-transparent bg-clip-text mb-3">
                  EVoting : <FlipWords words={words} />
                </h1>
                <BackgroundGradient className="inline-block rounded-lg p-1.5 mt-2">
                  <h2 className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-blue-900 via-purple-900 to-yellow-800 text-transparent bg-clip-text">
                    Verify your Email
                  </h2>
                </BackgroundGradient>
              </div>

          <div className="space-y-4 mt-8">
            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none backdrop-blur-sm transition-all"
                  required
                />
               <button
      type="submit"
      disabled={buttonDisabled}
      className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? <ButtonLoading /> : "Send Verification Code"}
    </button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter verification code"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none backdrop-blur-sm transition-all"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center"
                >
                  {loading ? "Verifying..." : "Verify"}
                </button>
              </form>
            )}

            {error && (
              <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </BackgroundGradient>
    </Suspense>
  );
}