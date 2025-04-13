// src/app/api/blockchain/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSignedContract } from "@/utils/blockchainUtils";
import { ethers } from "ethers";
import { SignatureErrorCodes } from "@/utils/errors/SignatureError";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      email,
      publicKey,
      signature,
      votingPublicKey,
      ringSignature,
      formattedKeyImage,
      VotingAddress,
      candidate,
    } = body;

    const contract = await getSignedContract();
    let tx;
    let result;

    try {
      switch (action) {
        case "submitVotingPublicKey": {
          if (!votingPublicKey || !ringSignature || !formattedKeyImage || !VotingAddress) {
            console.log("❌ Missing parameters:", {
              hasVotingPublicKey: !!votingPublicKey,
              hasRingSignature: !!ringSignature,
              hasformattedKeyImage: !!formattedKeyImage,
            });
            return NextResponse.json(
              { error: "Missing required parameters" },
              { status: 400 }
            );
          }

          try {
            // Ensure votingPublicKey is properly formatted
            if (!votingPublicKey.startsWith('0x')) {
              throw new Error('Invalid voting public key format');
            }

            // Submit the voting public key to the contract
            tx = await contract.submitVotingPublicKey(
              votingPublicKey,
              ringSignature,
              formattedKeyImage,
              VotingAddress
            );

            await tx.wait(1);

            result = {
              success: true,
              message: "Voting public key submitted successfully",
              txHash: tx.hash,
            };
          } catch (error: any) {
            console.error("❌ Error submitting voting public key:", {
              message: error.message,
              code: error.code,
              reason: error.reason,
              data: error.data,
            });

            if (error.message.includes("Key image already used")) {
              return NextResponse.json(
                {
                  error: "This key has already been used",
                  code: "KEY_IMAGE_USED",
                  details: error.reason || error.message,
                },
                { status: 400 }
              );
            }

            throw error;
          }
          break;
        }

        case "registerVoter": {
          if (!email || !publicKey || !signature) {
            console.log("❌ Missing parameters:", {
              hasEmail: !!email,
              hasPublicKey: !!publicKey,
              hasSignature: !!signature,
            });
            return NextResponse.json(
              { error: "Missing required parameters" },
              { status: 400 }
            );
          }

          try {
            // Parse the signature
            const sig = ethers.Signature.from(signature);

            // Create signature bytes array explicitly
            const signatureBytes = new Uint8Array(65);
            // Convert r and s from hex to bytes
            signatureBytes.set(ethers.getBytes(sig.r), 0); // 32 bytes
            signatureBytes.set(ethers.getBytes(sig.s), 32); // 32 bytes
            signatureBytes[64] = sig.v; // 1 byte

            tx = await contract.registerVoter(email, publicKey, signatureBytes);
            await tx.wait(1);

            result = {
              success: true,
              message: "Voter registered successfully",
              txHash: tx.hash,
            };
          } catch (error: any) {
            console.error("❌ Error details:", {
              message: error.message,
              code: error.code,
              reason: error.reason,
              data: error.data,
            });

            if (error.message.includes("Invalid signature")) {
              return NextResponse.json(
                {
                  error: "Signature verification failed in contract",
                  code: SignatureErrorCodes.VERIFICATION_FAILED,
                  details: error.reason || error.message,
                },
                { status: 400 }
              );
            }
            throw error;
          }
          break;
        }

        case "castVote": {
          // Validate inputs
          if (!candidate || !votingPublicKey || !signature) {
            console.log("❌ Missing parameters for voting:", {
              hasCandidate: !!candidate,
              hasVotingPublicKey: !!votingPublicKey,
              hasSignature: !!signature,
            });
            
            return NextResponse.json(
              { error: "Missing required parameters for voting" },
              { status: 400 }
            );
          }
          
          // Check if candidate exists in contract
          const candidates = await contract.getCandidates();
          const candidateExists = candidates.includes(candidate);
          
          if (!candidateExists) {
            return NextResponse.json(
              { error: "Invalid candidate" },
              { status: 400 }
            );
          }
          
          // console.log("🗳️ Casting vote with parameters:", {
          //   candidate,
          //   votingPublicKeyLength: votingPublicKey.length,
          //   signatureLength: signature.length,
          // });
          
          // Cast the vote on the blockchain
          tx = await contract.castVote(
            candidate,
            votingPublicKey,
            signature
          );
          
          // console.log("📝 Vote transaction submitted:", tx.hash);
          await tx.wait(1);
          // console.log("✅ Vote transaction confirmed");
          
          result = {
            success: true,
            hash: tx.hash,
            message: "Vote cast successfully",
          };
          break;
        }

        default:
          return NextResponse.json(
            { error: "Invalid action" },
            { status: 400 }
          );
      }

      // Handle contract interaction errors
      if (result) {
        return NextResponse.json(result);
      }
    } catch (error: any) {
      // Check for specific error types
      if (error.message.includes("insufficient funds")) {
        return NextResponse.json(
          {
            error:
              "The system is temporarily unable to process transactions due to insufficient funds. Please try again later.",
            details: error.message,
          },
          { status: 503 }
        );
      }

      if (error.message.includes("Key image already used")) {
        return NextResponse.json(
          {
            error: "This key has already been used",
            details: error.message,
          },
          { status: 400 }
        );
      }

      if (error.message.includes("Email already registered")) {
        return NextResponse.json(
          {
            error: "This email has already been registered.",
            details: error.message,
          },
          { status: 400 }
        );
      }

      if (error.message.includes("Invalid signature")) {
        return NextResponse.json(
          {
            error: "The provided signature is invalid.",
            details: error.message,
          },
          { status: 400 }
        );
      }
      
      if (error.message.includes("Voting key already used")) {
        return NextResponse.json(
          {
            error: "This voting key has already been used to cast a vote.",
            details: error.message,
          },
          { status: 400 }
        );
      }
      
      // Add additional error handling for Signature does not match registered voter
      if (error.message.includes("Signature does not match registered voter")) {
        return NextResponse.json(
          {
            error: "The signature does not match the registered voter address.",
            details: error.message,
          },
          { status: 400 }
        );
      }
      
      // Voting period not active error
      if (error.message.includes("VotingPeriodNotActive")) {
        return NextResponse.json(
          {
            error: "Voting is not currently active. The voting period may have ended or not yet begun.",
            details: error.message,
          },
          { status: 400 }
        );
      }
      
      console.error("🚫 Specific contract error:", {
        message: error.message,
        code: error.code,
        reason: error.reason,
        data: error.data,
      });
      
      throw error;
    }
  } catch (error) {
    console.error("🚫 API route error:", error);
    return NextResponse.json(
      {
        error: "Failed to process blockchain transaction",
        details:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}