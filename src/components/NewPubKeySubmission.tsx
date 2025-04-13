// src/components/NewPubKeySubmission.tsx

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/ui/loading";
import { AlertCircle, Clock, Key } from "lucide-react";
import { getContract } from "@/utils/blockchainUtils";
import { generateKeys } from "@/utils/keyGenerationUtils";

const NewPubKeySubmission = () => {
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmissionDisabled, setIsSubmissionDisabled] = useState(false);

  useEffect(() => {
    const checkSubmissionTimeLeft = async () => {
      try {
        const contract = await getContract();
        const submissionEndTime = await contract.submissionEndTime();
  
        const updateTimeLeft = () => {
          const currentTime = BigInt(Math.floor(Date.now() / 1000));
          const remainingSeconds = Number(submissionEndTime - currentTime);
  
          if (remainingSeconds <= 0) {
            setTimeLeft(0);
            setIsSubmissionDisabled(true);
            return false;
          }
  
          if (remainingSeconds <= 20) {
            setIsSubmissionDisabled(true);
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
        console.error("Error checking submission time:", err);
        setError("Failed to check submission time: Unable to connect to blockchain. Please check your network connection and refresh the page.");
      }
    };
  
    checkSubmissionTimeLeft();
  }, []);

  const parseBlockchainError = (errorMsg: string): string => {
    // Common blockchain errors with user-friendly messages
    if (errorMsg.includes("InsufficientFunds")) {
      return "Transaction failed: The election authority has insufficient funds to process this request.";
    }
    if (errorMsg.includes("KeyImageAlreadyUsed")) {
      return "This private key has already been used to generate a voting key. Each private key can only be used once.";
    }
    if (errorMsg.includes("user rejected transaction")) {
      return "Transaction was rejected in your wallet. Please try again and approve the transaction.";
    }
    if (errorMsg.includes("deadline exceeded")) {
      return "Transaction timed out. The network might be congested, please try again.";
    }
    if (errorMsg.includes("nonce")) {
      return "Transaction nonce error. Please refresh the page and try again.";
    }
    if (errorMsg.includes("gas") || errorMsg.includes("fee")) {
      return "Transaction failed due to gas/fee issues. Please check your wallet balance and try again.";
    }
    if (errorMsg.includes("Registration period has ended")) {
      return "Registration period has ended. You can no longer submit voting keys.";
    }
    
    // Return a more general message if no specific pattern is matched
    return `Blockchain error: ${errorMsg}`;
  };

  const submitToBlockchain = async (
    votingPublicKey: string,
    ringSignature: string,
    formattedKeyImage: string,
    VotingAddress:string,
  ): Promise<boolean> => {
    console.log("Starting blockchain submission with:", {
      votingPublicKey,
      ringSignature: ringSignature.substring(0, 32) + "...",  
      formattedKeyImage,
      VotingAddress
    });

    try {
      console.log("Sending POST request to /api/blockchain");
      const response = await fetch("/api/blockchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submitVotingPublicKey",
          votingPublicKey,
          ringSignature,
          formattedKeyImage,
          VotingAddress
        }),
      });

      console.log("Blockchain API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Blockchain submission failed:", errorData);
        
        // Handle specific HTTP status codes
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authorization error: You don't have permission to perform this action.");
        }
        if (response.status === 408 || response.status === 504) {
          throw new Error("Request timed out. The server took too long to respond, please try again.");
        }
        if (response.status === 429) {
          throw new Error("Too many requests. Please wait a moment before trying again.");
        }
        
        // Use the error message from the response if available
        if (errorData.error) {
          throw new Error(parseBlockchainError(errorData.error));
        }
        
        throw new Error(`Blockchain submission failed with status code: ${response.status}`);
      }

      const result = await response.json();
      console.log("Blockchain submission successful:", result);
      return true;
    } catch (error) {
      console.error("Error in blockchain submission:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "An unexpected error occurred while submitting the voting public key. Please check your network connection and try again."
      );
    }
  };

  const handleSubmit = async () => {
    console.log("Starting handleSubmit process");

    if (!privateKey) {
      console.warn("Submit attempted without private key");
      setError("Please enter your private key to continue");
      return;
    }

    if (privateKey.length < 64) {
      setError("Invalid private key: The key appears to be too short. Please enter a valid private key.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // 1. Generate new voting key pair
      console.log("Step 1: Generating new voting key pair");
      let votingKeyPair;
      try {
        votingKeyPair = await generateKeys();
      } catch (keyGenError) {
        console.error("Key generation failed:", keyGenError);
        throw new Error("Failed to generate voting keys: The key generation process encountered an error.");
      }
      const newVotingPubKey = votingKeyPair.publicKey;
      const VotingAddress = votingKeyPair.address;

      console.log("Generated voting public key:", newVotingPubKey);

      // 2. Get all verified public keys from contract
      console.log("Step 2: Fetching public keys from contract");
      let contract;
      let allPublicKeys;
      try {
        contract = await getContract();
        allPublicKeys = await contract.getAllEAPublicKeys();
      } catch (contractError) {
        console.error("Contract interaction failed:", contractError);
        throw new Error("Failed to retrieve public keys from the blockchain. Please check your network connection.");
      }
      
      console.log("Retrieved public keys count:", allPublicKeys.length);
      
      if (allPublicKeys.length === 0) {
        throw new Error("No public keys found on the blockchain. The election might not be properly initialized.");
      }

      // 3. Create ring signature
      console.log("Step 3: Creating ring signature");
      let caseId;
      try {
        caseId = await contract.getCaseId();
      } catch (caseIdError) {
        console.error("Failed to get case ID:", caseIdError);
        throw new Error("Failed to retrieve case ID from the blockchain.");
      }
      
      console.log("Case ID for signature:", caseId);

      const signPayload = {
        privateKey: privateKey,
        publicKeys: allPublicKeys,
        message: newVotingPubKey,
        caseId: caseId,
      };
      console.log("Sending signature creation request to /api/response/sign-vote");

      let signResponse;
      try {
        signResponse = await fetch("/api/response/sign-vote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(signPayload),
        });
      } catch (fetchError) {
        console.error("Sign-vote fetch failed:", fetchError);
        throw new Error("Network error while creating signature. Please check your internet connection and try again.");
      }

      console.log("Sign vote response status:", signResponse.status);
      if (!signResponse.ok) {
        const errorData = await signResponse.json().catch(() => ({}));
        console.error("Sign vote error data:", errorData);
        
        if (signResponse.status === 400) {
          throw new Error("Invalid private key: The key you provided doesn't match any known election authority key.");
        }
        if (signResponse.status === 422) {
          throw new Error("Invalid data: The signature creation failed due to incorrect data format.");
        }
        
        throw new Error(`Failed to create ring signature: ${errorData.error || `Server responded with status ${signResponse.status}`}`);
      }

      let signatureData;
      try {
        signatureData = await signResponse.json();
      } catch (jsonError) {
        console.error("Failed to parse sign vote response:", jsonError);
        throw new Error("Failed to parse signature response. The server returned invalid data.");
      }
      
      const { signature, keyImage } = signatureData;
      
      if (!signature || !keyImage) {
        throw new Error("Invalid signature response: Missing signature or key image.");
      }
      
      console.log("Received signature and key image:", {
        signatureLength: signature.length,
        keyImage,
      });

      // Format keyImage
      const formattedKeyImage = keyImage.startsWith("0x")
        ? keyImage
        : `0x${keyImage}`;

      // Check if key image is already used
      let isKeyImageUsed;
      try {
        isKeyImageUsed = await contract.isKeyImageUsed(formattedKeyImage);
      } catch (keyImageCheckError) {
        console.error("Key image check failed:", keyImageCheckError);
        throw new Error("Failed to verify key image uniqueness on the blockchain.");
      }
      
      if (isKeyImageUsed) {
        throw new Error("This private key has already been used to generate a voting key. Each key can only be used once.");
      }

      // 4. Verify ring signature
      console.log("Step 4: Verifying ring signature");
      const verifyPayload = {
        publicKeys: allPublicKeys,
        signature: signature,
        keyImage: keyImage,
        message: newVotingPubKey,
        caseId: caseId,
      };

      let verifyResponse;
      try {
        console.log("Sending verification request to /api/response/verify-signatures");
        verifyResponse = await fetch("/api/response/verify-signatures", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(verifyPayload),
        });
      } catch (verifyFetchError) {
        console.error("Verify signatures fetch failed:", verifyFetchError);
        throw new Error("Network error while verifying signature. Please check your internet connection and try again.");
      }

      console.log("Verify signatures response status:", verifyResponse.status);
      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => ({}));
        throw new Error(`Failed to verify signature: ${errorData.error || `Server responded with status ${verifyResponse.status}`}`);
      }

      let verifyData;
      try {
        verifyData = await verifyResponse.json();
      } catch (jsonError) {
        console.error("Failed to parse verify response:", jsonError);
        throw new Error("Failed to parse verification response. The server returned invalid data.");
      }
      
      const { isValid } = verifyData;
      console.log("Signature verification result:", isValid);

      if (!isValid) {
        throw new Error("Invalid signature generated. The verification process failed, which may indicate issues with your private key.");
      }

      // 5. Submit to blockchain
      console.log("Step 5: Submitting to blockchain");
      try {
        const success = await submitToBlockchain(
          newVotingPubKey,
          signature,
          formattedKeyImage,
          VotingAddress
        );

        if (!success) {
          throw new Error("Failed to submit to blockchain. The transaction was processed but returned a failure status.");
        }
      } catch (submitError) {
        console.error("Blockchain submission error:", submitError);
        if (submitError instanceof Error) {
          throw submitError; // This will use the already parsed error from submitToBlockchain
        }
        throw new Error("Failed to submit to blockchain due to an unexpected error.");
      }

      // 6. Create and trigger download of key pair
      console.log("Step 6: Preparing key pair download");
      try {
        const keyData = JSON.stringify(
          {
            votingPublicKey: newVotingPubKey,
            votingPrivateKey: votingKeyPair.privateKey,
            Address: VotingAddress
          },
          null,
          2
        ); // Pretty print with 2 spaces

        const blob = new Blob([keyData], {
          type: "text/plain;charset=utf-8", // Changed to text/plain instead of application/json
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "voting-keys.txt"; // Changed extension to .txt
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Clean up by revoking the object URL
      } catch (downloadError) {
        console.error("Download error:", downloadError);
        setSuccess("Voting key pair generated and new public key submitted successfully! WARNING: Failed to download key file. Please copy and save your keys manually:");
        setSuccess(prev => `${prev}\n\nPublic Key: ${newVotingPubKey}\nPrivate Key: ${votingKeyPair.privateKey}`);
        setLoading(false);
        return;
      }

      console.log("Key pair download triggered");
      setSuccess(
        "Voting key pair generated and new public key submitted successfully! Please save your downloaded keys in a secure location."
      );
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else if (typeof error === 'string') {
        setError(error);
      } else {
        setError("An unknown error occurred while processing your request. Please try again later.");
      }
    } finally {
      setLoading(false);
      console.log("HandleSubmit process completed");
    }
  };

  const renderTimeWarning = () => {
    if (!timeLeft) return null;
    
    if (timeLeft <= 0) {
      return (
        <Alert
          variant="destructive"
          className="mb-4 bg-red-900/30 border-red-500/30"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Submission Closed</AlertTitle>
          <AlertDescription className="text-gray-200">
            The submission period has ended. You can no longer submit voting public keys.
          </AlertDescription>
        </Alert>
      );
    }
    
    if (timeLeft <= 20) {
      return (
        <Alert
          variant="destructive"
          className="mb-4 bg-red-900/30 border-red-500/30"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Submission Disabled</AlertTitle>
          <AlertDescription className="text-gray-200">
            Public key submission has been disabled as less than 20 seconds
            remain in submission phase. This is to prevent transaction failures.
          </AlertDescription>
        </Alert>
      );
    }
  
    if (timeLeft <= 60) {
      return (
        <div className="mb-4 p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            <h4 className="text-sm font-semibold text-yellow-500">
              Warning: Limited Time Remaining
            </h4>
          </div>
          <p className="mt-1 text-sm text-yellow-300">
            Only {timeLeft} seconds left in submission phase! Submission will be
            disabled when only 20 seconds remain to prevent transaction failures.
            Please complete your submission quickly.
          </p>
        </div>
      );
    }
    
    return null;
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl text-center text-gray-200">
          Submit Your Voting Public Key
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderTimeWarning()}

        {error && (
          <Alert
            variant="destructive"
            className="bg-red-900/30 border-red-500/30"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="text-gray-200 whitespace-pre-line">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert
            variant="default"
            className="bg-green-900/30 border-green-500/30"
          >
            <AlertDescription className="text-gray-200 whitespace-pre-line">
              {success}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label className="block text-gray-200 font-medium">
            Your Election Authority Private Key
          </label>
          <Textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="Enter your private key to generate a new voting key pair"
            disabled={loading || isSubmissionDisabled}
            className="min-h-32 font-mono text-sm bg-gray-700 border-gray-600 text-gray-200 placeholder:text-gray-400"
            style={{ wordBreak: "break-all" }}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading || !privateKey || isSubmissionDisabled}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-900/50"
        >
          {loading ? (
            <ButtonLoading text="Generating keys..." />
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Key className="h-4 w-4" />
              Generate New Voting Key Pair
            </div>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default NewPubKeySubmission;