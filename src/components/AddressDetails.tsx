//src/components/AddressDetails.tsx

"use client";

import React from "react";
import { Copy, ExternalLink } from "lucide-react";
import { VOTING_CONTRACT_ADDRESS } from "@/constant";

const AddressDetails = () => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(VOTING_CONTRACT_ADDRESS);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleViewOnBscScan = () => {
    window.open(
      `https://testnet.bscscan.com/address/${VOTING_CONTRACT_ADDRESS}`,
      "_blank"
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-400">Smart Contract Details</h2>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-400">Contract Address</label>
        <div className="flex items-center space-x-2">
          <code className="flex-1 bg-gray-100 p-3 rounded-lg text-sm break-all font-mono">
            {VOTING_CONTRACT_ADDRESS}
          </code>
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Copy to clipboard"
          >
            <Copy className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
      <button
        onClick={handleViewOnBscScan}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors duration-200"
      >
        View on BSCScan
        <ExternalLink className="w-4 h-4" />
      </button>
    </div>
  );
};

export default AddressDetails;
