// src/utils/blockchainUtils.ts
 
import { VOTING_CONTRACT_ABI, VOTING_CONTRACT_ADDRESS } from '@/constant';
import { ethers } from 'ethers';

class ContractManager {
    private static instance: ContractManager;
    private provider: ethers.JsonRpcProvider | null = null;
    private contract: ethers.Contract | null = null;

    private constructor() {}

    public static getInstance(): ContractManager {
        if (!ContractManager.instance) {
            ContractManager.instance = new ContractManager();
        }
        return ContractManager.instance;
    }

    private async initializeProvider(): Promise<ethers.JsonRpcProvider> {
        if (!this.provider) {
            const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
            if (!rpcUrl) {
                throw new Error('RPC URL not configured');
            }
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
        }
        return this.provider;
    }

    public async getContract(): Promise<ethers.Contract> {
        if (!this.contract) {
            const provider = await this.initializeProvider();
            this.contract = new ethers.Contract(
                VOTING_CONTRACT_ADDRESS,
                VOTING_CONTRACT_ABI,
                provider
            );
        }
        return this.contract;
    }

    public async getSignedContract(): Promise<ethers.Contract> {
        const provider = await this.initializeProvider();
        if (!process.env.PRIVATE_KEY) {
            throw new Error('Private key not configured');
        }
        const privateKey = process.env.PRIVATE_KEY.startsWith('0x') 
            ? process.env.PRIVATE_KEY 
            : `0x${process.env.PRIVATE_KEY}`;
        const signer = new ethers.Wallet(privateKey, provider);
        return new ethers.Contract(
            VOTING_CONTRACT_ADDRESS,
            VOTING_CONTRACT_ABI,
            signer
        );
    }
}

export const MINIMUM_BALANCE = ethers.parseEther("0.2"); // 0.2 tBNB

       export const getContract = async (): Promise<ethers.Contract> => {
       try {
       return await ContractManager.getInstance().getContract();
       } catch (error) {
        throw new Error('Unable to connect to blockchain network');
       }
};

export const getSignedContract = async (): Promise<ethers.Contract> => {
    try {
        return await ContractManager.getInstance().getSignedContract();
    } catch (error) {
        throw new Error('Unable to initialize secure connection');
    }
};

export const checkKeyGeneration = async (email: string): Promise<boolean> => {
    const contract = await getContract();
    return await contract.hasGeneratedKeys(email);
};

export const checkAdminBalance = async (): Promise<{
    hasEnoughBalance: boolean;
    currentBalance: string;
    requiredBalance: string;
 }> => {
    try {
        const contract = await getContract();
        const adminBalance = await contract.getAdminBalance();
        
        return {
            hasEnoughBalance: adminBalance >= MINIMUM_BALANCE,
            currentBalance: ethers.formatEther(adminBalance),
            requiredBalance: "0.2"
        };
    } catch (error) {
        console.error("Error checking admin balance:", error);
        throw error;
    }
};

export const generateKeysOnChain = async (
    email: string,
    publicKey: string,
    signature: string
): Promise<boolean> => {
    const response = await fetch('/api/blockchain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'registerVoter',
            email,
            publicKey,
            signature
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
    }
    return true;
};

export const validateKeyFormat = (key: string): boolean => {
    try {
        const decoded = Buffer.from(key, 'base64').toString();
        return decoded.includes('BEGIN') && decoded.includes('END');
    } catch {
        return false;
    }
};

export const getCandidates = async (): Promise<string[]> => {
    try {
      const contract = await getContract();
      return await contract.getCandidates();
    } catch (error) {
      console.error("Error fetching candidates:", error);
      throw error;
    }
};

  export const getAllowedDomains = async (): Promise<string[]> => {
    try {
      const contract = await getContract();
      return await contract.getAllowedDomains();
    } catch (error) {
      console.error("Error fetching allowed domains:", error);
      throw error;
    }
};

export const getCaseId = async (): Promise<string> => {
    const contract = await getContract();
    return await contract.getCaseId();
  };
 