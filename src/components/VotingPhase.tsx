// src/components/VotingPhase.tsx

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { checkAdminBalance, getContract, getCandidates } from '@/utils/blockchainUtils';
import { ButtonLoading } from '@/components/ui/loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock } from 'lucide-react';

const VotingPhase = () => {
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
 
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const contractCandidates = await getCandidates();
        setCandidates(contractCandidates);
      } catch (err) {
        console.error('Error fetching candidates:', err);
        setError('Failed to fetch candidates. Please refresh the page.');
      }
    };

    fetchCandidates();
  }, []);

  useEffect(() => {
    const checkVotingTimeLeft = async () => {
      try {
        const contract = await getContract();
        const votingEndTime = await contract.votingEndTime();
        
        const updateTimeLeft = () => {
          const currentTime = BigInt(Math.floor(Date.now() / 1000));
          const remainingSeconds = Number(votingEndTime - currentTime);
          
          if (remainingSeconds <= 0) {
            setTimeLeft(0);
            setIsDisabled(true);
            return false;
          }
          
          if (remainingSeconds <= 20) {
            setIsDisabled(true);
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
        console.error('Error checking voting time:', err);
      }
    };

    checkVotingTimeLeft();
  }, []);

  // Parse the input to extract the private key if a JSON object is pasted
  const parsePrivateKeyInput = (input: string): string => {
    try {
      // Check if the input is a JSON object
      if (input.trim().startsWith('{') && input.trim().endsWith('}')) {
        const parsed = JSON.parse(input);
        if (parsed.votingPrivateKey) {
          return parsed.votingPrivateKey;
        }
      }
      
      // If not JSON or no votingPrivateKey property, return the input as is
      return input.trim();
    } catch (err) {
      // If JSON parsing fails, return the input as is
      return input.trim();
    }
  };

  // Function to check if voting key has been used
  const checkVotingKeyUsage = async (votingPublicKey: string): Promise<boolean> => {
    try {
      const contract = await getContract();
      
      // Get all voting public keys
      const votingPubKeys = await contract.getVotingPubKeys();
      
      // Find the index of our public key
      const keyIndex = votingPubKeys.findIndex(
        (key: string) => key.toLowerCase() === votingPublicKey.toLowerCase()
      );
      
      if (keyIndex === -1) {
        throw new Error('Invalid voting key: This key was not registered during the submission phase');
      }
      
      // Get the submission and check if it's used
      const submission = await contract.votingKeySubmissions(keyIndex);
      return submission.isUsed;
    } catch (err) {
      console.error('Error checking voting key usage:', err);
      throw err;
    }
  };

  const castVote = async () => {
    if (!selectedCandidate || !privateKey) {
      setError('Please select a candidate and enter your private key');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Parse the private key if it's provided as JSON
      const parsedPrivateKey = parsePrivateKeyInput(privateKey);
      
      // Check admin balance
      const balanceStatus = await checkAdminBalance();
      if (!balanceStatus.hasEnoughBalance) {
        setError(`System has insufficient balance for voting. Required: ${balanceStatus.requiredBalance} tBNB, Available: ${balanceStatus.currentBalance} tBNB. Please contact support.`);
        setLoading(false);
        return;
      }

      // Get the wallet from private key
      const normalizedPrivateKey = parsedPrivateKey.startsWith('0x') 
        ? parsedPrivateKey 
        : `0x${parsedPrivateKey}`;
      const wallet = new ethers.Wallet(normalizedPrivateKey);
      
      // Get the voting public key
      const votingPublicKey = ethers.SigningKey.computePublicKey(wallet.privateKey, true);
      console.log("Using voting public key:", votingPublicKey);
      
      // Check if the key has already been used for voting
      const isUsed = await checkVotingKeyUsage(votingPublicKey);
      if (isUsed) {
        setError('This voting key has already been used to cast a vote. Each key can only be used once.');
        setLoading(false);
        return;
      }
      
      // Create the message to sign (candidate + voting public key)
      const messageToSign = ethers.keccak256(ethers.toUtf8Bytes(selectedCandidate + votingPublicKey));
      
      // Sign the message with private key
      const signature = await wallet.signMessage(ethers.getBytes(messageToSign));
      
      // Submit the vote to the blockchain
      const response = await fetch('/api/blockchain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'castVote',
          candidate: selectedCandidate,
          votingPublicKey: votingPublicKey,
          signature: signature
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cast vote');
      }
      
      // Display success message
      setSuccess('Your vote has been successfully cast!');
      setSelectedCandidate('');
      setPrivateKey('');
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('insufficient')) {
          setError('The system currently has insufficient funds to process your vote. Please try again later or contact support.');
        } else if (err.message.includes('User rejected')) {
          setError('Transaction was cancelled.');
        } else if (err.message.includes('already been used')) {
          setError('This voting key has already been used. Each key can only be used once to cast a vote.');
        } else if (err.message.includes('Invalid voting key')) {
          setError('Invalid voting key: The provided key was not registered during the submission phase.');
        } else {
          setError(`Error: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTimeLeft = () => {
    if (!timeLeft) return '';
    
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const renderTimeWarning = () => {
    if (!timeLeft || timeLeft > 60) return null;
    
    if (timeLeft <= 20) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Voting Disabled</AlertTitle>
          <AlertDescription>
            Voting has been disabled as less than 20 seconds remain. This is to prevent transaction failures.
          </AlertDescription>
        </Alert>
      );
    }
    
    return (
      <div className="mb-4 p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-500" />
          <h4 className="text-sm font-semibold text-yellow-500">Warning: Limited Time Remaining</h4>
        </div>
        <p className="mt-1 text-sm text-yellow-300">
          Only {formatTimeLeft()} left to vote! Voting will be disabled when only 20 seconds remain to prevent transaction failures. Please submit your vote quickly.
        </p>
      </div>
    );
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl text-center text-gray-200">
          Cast Your Vote
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderTimeWarning()}
        
        {error && (
          <Alert variant="destructive" className="bg-red-900/30 border-red-500/30">
            <AlertDescription className="text-gray-200">
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert variant="default" className="bg-green-900/30 border-green-500/30">
            <AlertDescription className="text-gray-200">
              {success}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label className="block text-gray-200 font-medium">Select Candidate</label>
          <Select 
            disabled={loading || isDisabled} 
            value={selectedCandidate} 
            onValueChange={setSelectedCandidate}
          >
            <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-gray-200">
              <SelectValue placeholder="Select a candidate..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600">
              {candidates.map((candidate) => (
                <SelectItem 
                  key={candidate} 
                  value={candidate} 
                  className="text-gray-200 hover:bg-gray-600"
                >
                  {candidate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="block text-gray-200 font-medium">Your Voting Private Key</label>
          <Textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="Input your voting private key that was generated during the submission phase. You can paste the entire JSON object or just the private key value."
            disabled={loading || isDisabled}
            className="min-h-32 font-mono text-sm bg-gray-700 border-gray-600 text-gray-200 placeholder:text-gray-400"
            style={{ wordBreak: 'break-all' }}
          />
        </div>

        <Button
          onClick={castVote}
          disabled={loading || !selectedCandidate || !privateKey || isDisabled}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-900/50"
        >
          {loading ? <ButtonLoading text="Casting Vote..." /> : 'Cast Vote'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default VotingPhase;