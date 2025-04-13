//src/components/EAPublicKeyDisplay.tsx

import React, { useState } from 'react';
import { getContract } from '@/utils/blockchainUtils';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ButtonLoading } from '@/components/ui/loading';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const EAPublicKeysDisplay = () => {
  const [publicKeys, setPublicKeys] = useState<{key: string}[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const fetchPublicKeys = async () => {
    if (publicKeys.length > 0) return;
    try {
      setLoading(true);
      setError('');
      const contract = await getContract();
      const registeredEmails = await contract.getRegisteredEmails();
      const allPublicKeys = await contract.getAllEAPublicKeys();
      setEmails(registeredEmails);
      setPublicKeys(allPublicKeys.map((key: string) => ({ key })));
    } catch (err) {
      console.error('Error fetching public keys:', err);
      setError('Failed to fetch public keys');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) fetchPublicKeys();
    }}>
      <DialogTrigger asChild>
        <button className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2">
          {loading ? <ButtonLoading /> : <span>Show EA Public Keys</span>}
        </button>
      </DialogTrigger>

      <DialogContent className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] md:w-[calc(100%-6rem)] lg:w-[90%] max-w-3xl bg-gray-800 border-gray-700 text-white z-50 rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">Total Submission: {publicKeys.length} Public key{publicKeys.length !== 1 ? "'s" : ''}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert className="mt-4 bg-red-900/20 border-red-500 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="max-h-[60vh] overflow-y-auto px-4 py-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-4">
              <ButtonLoading />
            </div>
          ) : publicKeys.length === 0 ? (
            <p className="text-white">No public keys submitted yet.</p>
          ) : (
            <div className="space-y-4">
              {publicKeys.map((item, index) => (
                <div key={index} className="bg-gray-700/30 p-4 rounded-lg border border-gray-600">
                  <p className="font-medium text-white mb-2">
                    Email: {emails[index] || 'Unknown'}
                  </p>
                  <p className="text-sm break-all bg-gray-800/50 p-3 rounded border border-gray-700 text-gray-300">
                    {item.key}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EAPublicKeysDisplay;