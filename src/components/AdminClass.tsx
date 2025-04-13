//src/components/AdminClass.tsx

import { FC } from 'react';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { isAdmin } from '@/config/admin';

interface DeploymentConfig {
  candidates: string[];
  registrationDuration: string;
  submissionDuration: string;  
  votingDuration: string;
  allowedDomains: string[];
}

interface ValidationErrors {
  candidates?: string;
  registrationDuration?: string;
  submissionDuration?: string;  
  votingDuration?: string;
  allowedDomains?: string;
}

interface AdminClassProps {
  onDeployStart: () => void;
}

const AdminClass: FC<AdminClassProps> = ({ onDeployStart }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [error, setError] = useState('');
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig>({
    candidates: [],
    registrationDuration: '',
    submissionDuration: '',  
    votingDuration: '',
    allowedDomains: []
  });
  const [showConfig, setShowConfig] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    const updateViewportHeight = () => {
      setViewportHeight(window.visualViewport?.height || window.innerHeight);
    };

    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    updateViewportHeight();

    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setDeploying(false);
      setIsOpen(false);
      router.refresh();
    }
  }, [countdown, router]);

  const handleFocus = () => {
    if (window.innerWidth <= 768) {
      setIsKeyboardOpen(true);
    }
  };

  const handleBlur = () => {
    setIsKeyboardOpen(false);
  };

  const validateConfig = (): boolean => {
    const errors: ValidationErrors = {};
    let isValid = true;

    if (deploymentConfig.candidates.length < 2) {
      errors.candidates = 'At least 2 candidates are required';
      isValid = false;
    }

    const regDuration = parseInt(deploymentConfig.registrationDuration);
    if (isNaN(regDuration) || regDuration < 299) {
      errors.registrationDuration = 'Registration duration must be at least 5 minutes (300 seconds)';
      isValid = false;
    }
 
    const submissionDuration = parseInt(deploymentConfig.submissionDuration);
    if (isNaN(submissionDuration) || submissionDuration < 299) {
      errors.submissionDuration = 'Submission duration must be at least 5 minutes (300 seconds)';
      isValid = false;
    }

    const voteDuration = parseInt(deploymentConfig.votingDuration);
    if (isNaN(voteDuration) || voteDuration < 299) {
      errors.votingDuration = 'Voting duration must be at least 5 minutes (300 seconds)';
      isValid = false;
    }

    if (deploymentConfig.allowedDomains.length < 1) {
      errors.allowedDomains = 'At least one domain is required';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleEmailSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      if (!isAdmin(email)) {
        setError('Not authorized as admin');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/sendEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
           type: 'verification',
        verificationType: 'deploy'
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setShowVerification(true);
      } else {
        setError(data.error || 'Failed to send verification code');
      }
    } catch (err) {
      setError('Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/sendEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          verificationCode,
          type: 'verify'
        })
      });
      
      const data = await res.json();
      
      if (data.verified) {
        if (isAdmin(email)) {
          setShowConfig(true);
          setShowVerification(false);
        } else {
          setError('Not authorized as admin');
        }
      } else {
        setError('Invalid verification code');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!validateConfig()) {
      return;
    }
  
    setDeploying(true);
    setError('');
  
    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          config: deploymentConfig
        })
      });
  
      const data = await response.json();
  
      if (data.success) {
        setCountdown(5); // 5 second countdown before closing
        onDeployStart(); // Notify parent component
      } else {
        setError(data.error || 'Deployment failed. Please try again.');
      }
    } catch (err) {
      console.error('Deployment error:', err);
      setError('Failed to deploy contract. Please check console for details.');
    } finally {
      setDeploying(false);
    }
  };
  
  const dialogStyle = {
    position: 'fixed',
    top: isKeyboardOpen ? '5%' : '50%',
    transform: isKeyboardOpen ? 'translate(-50%, 0)' : 'translate(-50%, -50%)',
    maxHeight: isKeyboardOpen ? `${viewportHeight * 0.9}px` : 'auto',
    overflowY: 'auto'
  } as const;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="mr-4">Admin Class</Button>
      </DialogTrigger>
      <DialogContent className="fixed w-[calc(100%-2rem)] max-w-md bg-gray-800 border-gray-700 text-white z-50 left-[50%]" style={dialogStyle}>
        <DialogHeader>
          <DialogTitle>Admin Class</DialogTitle>
        </DialogHeader>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="px-4">
          {!showVerification && !showConfig && (
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="Enter admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full"
              />
              <Button 
                onClick={handleEmailSubmit} 
                disabled={loading}
                className="w-full"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Verify Email'}
              </Button>
            </div>
          )}
           
          {showVerification && (
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Enter verification code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full"
              />
              <Button 
                onClick={handleVerification} 
                disabled={loading}
                className="w-full"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Verify Code'}
              </Button>
            </div>
          )}

          {showConfig && (
            <div className="space-y-4 pb-4">
              <div>
                <Input
                  type="text"
                  placeholder="Candidates (comma-separated)"
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    candidates: e.target.value.split(',').map(c => c.trim())
                  }))}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                {validationErrors.candidates && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.candidates}</p>
                )}
              </div>

              <div>
                <Input
                  type="number"
                  placeholder="Registration Duration (seconds)"
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    registrationDuration: e.target.value
                  }))}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                {validationErrors.registrationDuration && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.registrationDuration}</p>
                )}
              </div>
 
              <div>
                <Input
                  type="number"
                  placeholder="Submission Duration (seconds)"
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    submissionDuration: e.target.value
                  }))}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                {validationErrors.submissionDuration && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.submissionDuration}</p>
                )}
              </div>

              <div>
                <Input
                  type="number"
                  placeholder="Voting Duration (seconds)"
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    votingDuration: e.target.value
                  }))}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                {validationErrors.votingDuration && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.votingDuration}</p>
                )}
              </div>

              <div>
                <Input
                  type="text"
                  placeholder="Allowed Domains (comma-separated)"
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    allowedDomains: e.target.value.split(',').map(d => d.trim())
                  }))}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                {validationErrors.allowedDomains && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.allowedDomains}</p>
                )}
              </div>

              <Button 
                onClick={handleDeploy} 
                disabled={deploying}
                className="w-full"
              >
                {deploying ? (
                  countdown !== null ? 
                    `Redeploying... (${countdown}s)` : 
                    <Loader2 className="animate-spin" />
                ) : (
                  'Deploy Contract'
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminClass;