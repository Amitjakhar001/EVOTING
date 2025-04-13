// src/components/registration.tsx

import React, { useState, useEffect } from "react";
import {
  generateKeysOnChain,
  checkKeyGeneration,
  checkAdminBalance,
  getContract,
  getCandidates,
  getAllowedDomains
} from "@/utils/blockchainUtils";
import { Loading, ButtonLoading } from "@/components/ui/loading";
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  Key,
  Check,
  Copy,
  Clock,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { SignatureErrorCodes } from "@/utils/errors/SignatureError";

interface Keys {
  publicKey: string;
  privateKey: string;
  status?: string;
  digest?: string;
  keyCoordinate?: string;
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={copyToClipboard}
      className="p-2 rounded-lg hover:bg-gray-600/50 transition-colors absolute right-2 top-2"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-400" />
      ) : (
        <Copy className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );
};

const RegistrationPage = () => {
  const [keys, setKeys] = useState<Keys | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [hasGeneratedKey, setHasGeneratedKey] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState("");
  const [buttonDisabled, setButtonDisabled] = useState(true);
  const [verifyButtonDisabled, setVerifyButtonDisabled] = useState(true);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isRegistrationDisabled, setIsRegistrationDisabled] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setPageLoading(true);
        const [contractCandidates, domains] = await Promise.all([
          getCandidates(),
          getAllowedDomains()
        ]);
        setCandidates(contractCandidates);
        setAllowedDomains(domains);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to fetch data. Please refresh the page.");
      }
      finally {
        setPageLoading(false);
      }
    };

    fetchData();
  }, []);

  const isAllowedDomain = (email: string): boolean => {
    return allowedDomains.some(domain => email.endsWith(domain));
  };

  const emailPlaceholder = allowedDomains.length > 0 
  ? `Enter your email (${allowedDomains.join(" or ")})`
  : "Enter your email";
   

  useEffect(() => {
    const isValidEmail = email && isAllowedDomain(email);
    setButtonDisabled(
      !isValidEmail || loading || hasGeneratedKey || isRegistrationDisabled  
    );
  }, [email, loading, hasGeneratedKey, isRegistrationDisabled]);

  useEffect(() => {
    const checkRegistrationTimeLeft = async () => {
      try {
        const contract = await getContract();
        const registrationEndTime = await contract.registrationEndTime();

        const updateTimeLeft = () => {
          const currentTime = BigInt(Math.floor(Date.now() / 1000));
          const remainingSeconds = Number(registrationEndTime - currentTime);

          if (remainingSeconds <= 0) {
            setTimeLeft(0);
            setIsRegistrationDisabled(true);
            return false;
          }

          if (remainingSeconds <= 20) {
            setIsRegistrationDisabled(true);
          }

          setTimeLeft(remainingSeconds);
          return true;
        };

        if (updateTimeLeft()) {
          const interval = setInterval(() => {
            const shouldContinue = updateTimeLeft();
            if (!shouldContinue) {
              clearInterval(interval);
            }
          }, 1000);

          return () => clearInterval(interval);
        }
      } catch (err) {
        console.error("Error checking registration time:", err);
        setError("Failed to check registration time. Please refresh the page.");
      }
    };

    checkRegistrationTimeLeft();
  }, []);

  useEffect(() => {
    setVerifyButtonDisabled(
      !verificationCode || loading || isRegistrationDisabled
    );
  }, [verificationCode, loading, isRegistrationDisabled]);

  useEffect(() => {
    const checkStatus = async () => {
      if (!email || !isAllowedDomain(email)) return;
      try {
        const generatedStatus = await checkKeyGeneration(email);
        setHasGeneratedKey(generatedStatus);
      } catch (err) {
        console.error("Error checking key status:", err);
      }
    };
    checkStatus();
  }, [email]);

   
  const sendVerificationEmail = async () => {
    if (buttonDisabled) return;

    setLoading(true);
    setButtonDisabled(true);

    try {
      const isEligible = await checkEmailEligibility(email);
      if (!isEligible) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/sendEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          type: "verification",
          verificationType: "generation",
        }),
      });

      if (!response.ok) throw new Error("Failed to send verification email");
      setShowVerification(true);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send verification"
      );
    } finally {
      setLoading(false);
      setTimeout(() => setButtonDisabled(false), 30000);
    }
  };

  const verifyCodeAndProceed = async () => {
    if (verifyButtonDisabled) return;

    setLoading(true);
    setVerifyButtonDisabled(true);

    try {
      const response = await fetch("/api/sendEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "verify", verificationCode }),
      });

      const data = await response.json();
      if (!data.verified) throw new Error("Invalid verification code");

      await generateKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
      setVerifyButtonDisabled(false);
    }
  };

  // const handleGenerationError = (err: any) => {
  //   console.error("Generation error:", err);
  //   let errorMessage = "Failed to generate keys. ";

  //   // Handle blockchain specific errors
  //   if (err.message?.includes("Keys already generated for this email")) {
  //     errorMessage = "Keys have already been generated for this email address. Please use a different email.";
  //     setHasGeneratedKey(true);
  //   } else if (err.message?.includes("insufficient funds")) {
  //     errorMessage = "The system currently has insufficient funds. Please try again later or contact support.";
  //   } else if (err.message?.includes("user rejected")) {
  //     errorMessage = "Transaction was cancelled by user.";
  //   } else if (err.message?.includes("network error")) {
  //     errorMessage = "Network error occurred. Please check your connection and try again.";
  //   } else if (typeof err === 'object' && err.reason) {
  //     // Handle ethers.js specific error format
  //     errorMessage = err.reason;
  //   } else if (err instanceof Error) {
  //     errorMessage = err.message;
  //   }

  //   setError(errorMessage);
  //   setKeys(null);
  // };
 


  // src/components/registration.tsx generate function
  const generateKeys = async () => {
    try {
        setLoading(true);
        setError("");

        // Check if registration is still allowed
        if (isRegistrationDisabled) {
            throw new Error(
                "Registration period has ended or is about to end. Key generation is disabled."
            );
        }

        // Check if keys already exist for this email
        const keyStatus = await checkKeyGeneration(email);
        if (keyStatus) {
            throw new Error(
                "Keys have already been generated for this email address. Please use a different email."
            );
        }

        // Check contract balance
        const balanceStatus = await checkAdminBalance();
        if (!balanceStatus.hasEnoughBalance) {
            throw new Error(
                `Insufficient contract balance for transaction. Required: ${balanceStatus.requiredBalance} tBNB, Available: ${balanceStatus.currentBalance} tBNB. Please contact support.`
            );
        }

        // Generate keys from API
        const response = await fetch('/api/response/generate-keys', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to generate keys: ${errorData}`);
        }

        const keyData = await response.json();
        if (!keyData.publicKey || !keyData.privateKey || keyData.status !== "success") {
            throw new Error("Invalid key data received from server");
        }
 
        // Get EA Signature
        const signatureRes = await fetch('/api/sign-public-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, publicKey: keyData.publicKey })
        });

        if (!signatureRes.ok) {
            const errorData = await signatureRes.json();
            throw new Error(errorData.error || 'Failed to get Election Authority signature');
        }

        const { signature } = await signatureRes.json();

        // Get EA Public Key from contract
        const contract = await getContract();
        const eaPublicKey = await contract.getElectionAuthorityPublicKey();

        // Create certificate object (not storing on chain)
        const certificate = {
            userPublicKey: keyData.publicKey,
            electionAuthorityPublicKey: eaPublicKey,
            signature: signature
        };

        // Store on blockchain
        try {
            await generateKeysOnChain(email, keyData.publicKey, signature);
            setHasGeneratedKey(true);
        } catch (err: any) {
            const errorData = err.response?.data || err;
            if (errorData.code && errorData.code.startsWith('SIGNATURE_')) {
                const errorMessage = 
                    errorData.code === SignatureErrorCodes.VERIFICATION_FAILED
                        ? 'Signature verification failed. Please try generating keys again.'
                        : 'Invalid signature detected. Please contact support.';
                setError(errorMessage);
                return;
            }
            throw err;
        }

        // Prepare keys package for user
        const keys = {
            publicKey: keyData.publicKey,
            privateKey: keyData.privateKey,
            certificate: certificate,   
            status: "success",
            digest: keyData.digest,
            keyCoordinate: keyData.keyCoordinate
        };
        setKeys(keys);

        // Send email with keys and certificate
        try {
            const emailResponse = await fetch("/api/sendEmail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    type: "keys",
                    keys: keys,
                }),
            });

            if (!emailResponse.ok) {
                setError("Keys generated successfully but failed to send email. Please download your keys.");
            } else {
                setError("Your Keys and Certificate sent to your email successfully!");
            }
        } catch (emailErr) {
            setError("Keys generated successfully but failed to send email. Please make sure to download your keys.");
        }

    } catch (err) {
        console.error('Key generation error:', err);
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMessage);
    } finally {
        setLoading(false);
    }
};

  const renderTimeWarning = () => {
    if (!timeLeft || timeLeft > 60) return null;

    if (timeLeft <= 20) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Registration Disabled</AlertTitle>
          <AlertDescription>
            Key generation has been disabled as less than 20 seconds remain.
            This is to prevent transaction failures.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="mb-4 p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-500" />
          <h4 className="text-sm font-semibold text-yellow-500">
            Warning: Limited Time Remaining
          </h4>
        </div>
        <p className="mt-1 text-sm text-yellow-300">
          Only {timeLeft} seconds left to generate keys! Registration will be
          disabled when only 20 seconds remain to prevent transaction failures.
          Please complete your registration quickly.
        </p>
      </div>
    );
  };

  const downloadKeys = () => {
    if (!keys) return;
    const content = `Public Key:\n${keys.publicKey}\n\nPrivate Key:\n${keys.privateKey}\n\nDigest:\n${keys.digest}\n\nKey Coordinates:\n${keys.keyCoordinate}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voting-keys.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const checkEmailEligibility = async (email: string): Promise<boolean> => {
    if (!isAllowedDomain(email)) {
      setError(
        `Please use one of these email domains: ${allowedDomains.join(
          ", "
        )}`
      );
      return false;
    }

    try {
      if (hasGeneratedKey) {
        setError("Keys have already been generated for this email");
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error checking eligibility:", err);
      setError("Failed to verify email eligibility");
      return false;
    }
  };

  if (pageLoading) {
    return <Loading text="Loading registration..." className="h-screen" />;
  }

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800 p-8 rounded-3xl">
      <div className="max-w-4xl mx-auto space-y-6">
        {backendStatus && (
          <div
            className={`p-4 rounded-lg border ${
              backendStatus === "Connected"
                ? "bg-green-900/20 border-green-500 text-green-400"
                : "bg-red-900/20 border-red-500 text-red-400"
            } flex items-center space-x-2`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                backendStatus === "Connected" ? "bg-blue-400" : "bg-red-400"
              } animate-pulse`}
            />
            <span>Backend Status: {backendStatus}</span>
          </div>
        )}

        {renderTimeWarning()}

        <Card className="bg-gray-800/50 border-gray-700 rounded-xl overflow-hidden">
          <CardHeader className="bg-gray-800/30">
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <Key className="w-6 h-6" />
              Generate Your Keys
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
          {candidates.length > 0 ? (
  <div className="space-y-2">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between bg-gray-700/30 border-gray-600 text-gray-200">
          View Participating Candidates
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px] bg-gray-700 border-gray-600">
        <DropdownMenuLabel className="text-gray-200">Candidates</DropdownMenuLabel>
        {candidates.map((candidate) => (
          <DropdownMenuItem
            key={candidate}
            className="text-gray-200 hover:bg-gray-600 focus:bg-gray-600"
          >
            {candidate}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
) : (
  <div className="text-center text-gray-400 py-2">
    Loading candidates...
  </div>
)}
         
            <div className="space-y-6">
              {!showVerification ? (
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      onBlur={() => email && checkEmailEligibility(email)}
                      placeholder={emailPlaceholder}
                      className="w-full p-3 pl-10 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading || isRegistrationDisabled}
                    />
                    <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                  </div>

                  {email && !error && hasGeneratedKey && (
                    <Alert className="bg-red-900/20 border-red-500 text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        Keys have already been generated for this email
                      </AlertDescription>
                    </Alert>
                  )}

                  <button
                    onClick={sendVerificationEmail}
                    disabled={buttonDisabled || isRegistrationDisabled}
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-800/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <ButtonLoading />
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        <span>Send Verification Code</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter verification code"
                    className="w-full p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading || isRegistrationDisabled}
                  />
                  <button
                    onClick={verifyCodeAndProceed}
                    disabled={verifyButtonDisabled || isRegistrationDisabled}
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-800/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <ButtonLoading />
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Verify and Generate Keys</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <Alert
                className={`mt-4 border ${
                  error.includes("successfully")
                    ? "bg-green-900/20 border-green-500 text-green-400"
                    : "bg-red-900/20 border-red-500 text-red-400"
                }`}
              >
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {keys && (
              <div className="space-y-4">
                <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600 relative">
                  <h3 className="font-medium text-white mb-2">Public Key:</h3>
                  <p className="break-all text-sm bg-gray-800/50 p-3 rounded border border-gray-700 text-gray-300 pr-12">
                    {keys.publicKey}
                  </p>
                  <CopyButton text={keys.publicKey} />
                </div>

                <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600 relative">
                  <h3 className="font-medium text-white mb-2">Private Key:</h3>
                  <p className="break-all text-sm bg-gray-800/50 p-3 rounded border border-gray-700 text-gray-300 pr-12">
                    {keys.privateKey}
                  </p>
                  <CopyButton text={keys.privateKey} />
                </div>

                {keys.digest && (
                  <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600 relative">
                    <h3 className="font-medium text-white mb-2">Key Digest:</h3>
                    <p className="break-all text-sm bg-gray-800/50 p-3 rounded border border-gray-700 text-gray-300 pr-12">
                      {keys.digest}
                    </p>
                    <CopyButton text={keys.digest} />
                  </div>
                )}

                {keys.keyCoordinate && (
                  <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600 relative">
                    <h3 className="font-medium text-white mb-2">
                      Key Coordinates:
                    </h3>
                    <p className="break-all text-sm bg-gray-800/50 p-3 rounded border border-gray-700 text-gray-300 pr-12">
                      {keys.keyCoordinate}
                    </p>
                    <CopyButton text={keys.keyCoordinate} />
                  </div>
                )}

                <button
                  onClick={downloadKeys}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Key className="w-5 h-5" />
                  <span>Download Keys</span>
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
  
};

export default RegistrationPage;