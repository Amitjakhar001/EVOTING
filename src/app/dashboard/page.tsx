//src/app/dashboard/page.tsx

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RegistrationPage from "@/components/registration";
import AddressDetails from "@/components/AddressDetails";
import VotingPhase from "@/components/VotingPhase";
import Result from "@/components/Result";
import { getContract } from "@/utils/blockchainUtils";
import RegistrationTimer, {
  VotingPhase as Phase,
} from "@/components/PhaseTime";
import EAPublicKeysDisplay from "@/components/EAPublicKeyDisplay";
import AdminClass from "@/components/AdminClass";
import { Alert, AlertDescription } from "@/components/ui/alert";
import NewPubKeySubmission from "@/components/NewPubKeySubmission";
import VotingPublicKeysDisplay from "@/components/VotingPubKeysDisplay";

const Dashboard = () => {
  const router = useRouter();
  const [currentPhase, setCurrentPhase] = useState<Phase>(Phase.REGISTRATION);
  const [loading, setLoading] = useState(true);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check session on mount
  useEffect(() => {
    const isVerified = sessionStorage.getItem("isVerified");
    if (!isVerified) {
      router.push("/");
    }
  }, [router]);

  // Handle phase checking and transitions
  useEffect(() => {
    const checkPhase = async () => {
      try {
        setError(null);
        const contract = await getContract();
        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        const registrationEndTime = await contract.registrationEndTime();
        const submissionEndTime = await contract.submissionEndTime();
        const votingEndTime = await contract.votingEndTime();

        let newPhase;
        if (currentTime >= votingEndTime) {
          newPhase = Phase.ENDED;
        } else if (currentTime >= submissionEndTime) {
          newPhase = Phase.VOTING;
        } else if (currentTime >= registrationEndTime) {
          newPhase = Phase.SUBMISSION;
        } else {
          newPhase = Phase.REGISTRATION;
        }

        if (newPhase !== currentPhase) {
          setCurrentPhase(newPhase);
        }
      } catch (error) {
        console.error("Error checking phase:", error);
        setError("Failed to check current phase. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    checkPhase();
    const interval = setInterval(checkPhase, 5000);
    return () => clearInterval(interval);
  }, [currentPhase]);

  // Handle global loading state during redeployment
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setGlobalLoading(false);
      setCountdown(null);
      window.location.reload();
    }
  }, [countdown]);

  const handleLogout = () => {
    sessionStorage.removeItem("isVerified");
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  if (globalLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <div className="text-xl text-white">Redeploying Contract...</div>
        {countdown !== null && (
          <div className="text-lg font-mono text-white">
            Please wait {countdown} seconds
          </div>
        )}
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  const renderPhaseComponent = () => {
    switch (currentPhase) {
      case Phase.REGISTRATION:
        return <RegistrationPage />;
      case Phase.SUBMISSION:
        return <NewPubKeySubmission />;
      case Phase.VOTING:
        return <VotingPhase />;
      case Phase.ENDED:
        return <Result />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center gap-2">
            <AdminClass
              onDeployStart={() => {
                setGlobalLoading(true);
                setCountdown(120);
              }}
            />
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-lg mb-8 p-6 space-y-4">
          <AddressDetails />
          <RegistrationTimer currentPhaser={currentPhase} />
        </div>

        {renderPhaseComponent()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="w-full">
            <EAPublicKeysDisplay />
          </div>
          <div className="w-full">
            <VotingPublicKeysDisplay/>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;