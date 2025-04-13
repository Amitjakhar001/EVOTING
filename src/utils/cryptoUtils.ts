// src/utils/cryptoUtils.ts
 
import { ec as EC } from "elliptic";
import { sha3_256, sha3_512 } from "js-sha3";
import BN from "bn.js";

// Initialize elliptic curve - we'll use secp256k1 like LIRISI
const ec = new EC("secp256k1");

export interface ECPoint {
  x: BN;
  y: BN;
}

export interface KeyPair {
  privateKey: BN;
  publicKey: ECPoint;
}

export interface RingSignature {
  keyImage: ECPoint;
  checksum: Uint8Array;
  signatures: Uint8Array[];
}

export class CryptoUtils {
  // Static utility methods
  public static readonly utils = {
    bufferToBN: (buf: Buffer): BN => new BN(buf),
    bnToBuffer: (bn: BN): Buffer => bn.toArrayLike(Buffer, "be", 32),
    pointToBuffer: (point: ECPoint): Buffer => {
      const x = point.x.toArrayLike(Buffer, "be", 32);
      const y = point.y.toArrayLike(Buffer, "be", 32);
      return Buffer.concat([x, y]);
    },
    bnToHex: (bn: BN): string => bn.toString(16).padStart(64, "0"),
    // Helper for logging points in hex format
    pointToHex: (point: ECPoint): {x: string, y: string} => ({
      x: point.x.toString(16).padStart(64, '0'),
      y: point.y.toString(16).padStart(64, '0')
    }),
    // Helper for logging Uint8Arrays as hex
    bytesToHex: (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex'),
  };

  // Factory context equivalent
  private static readonly curve = ec.curve;
  private static readonly p = ec.curve.p; // Field prime
  private static readonly n = ec.curve.n; // Curve order
  private static readonly G = ec.curve.g; // Generator point

  static async generateKeyPair(): Promise<KeyPair> {
    try {
      const keyPair = ec.genKeyPair();
      // console.log(keyPair);
      const privateKey = keyPair.getPrivate();
      // console.log(privateKey);
      const pub = keyPair.getPublic();
      // console.log(pub);

      return {
        privateKey: privateKey,
        publicKey: {
          x: pub.getX(),
          y: pub.getY(),
        },
      };
    } catch (error) {
      console.error("Error generating key pair:", error);
      throw new Error("Failed to generate key pair");
    }
  }

  private static async hashToPoint(input: Uint8Array): Promise<ECPoint> {
    try {
      // Create a deterministic but seemingly random private key from input
      const hash = sha3_512.array(input);
      let privKey = new BN(Buffer.from(hash.slice(0, 32)));

      // Ensure private key is in valid range
      privKey = privKey.mod(this.n);

      // Generate point by multiplying generator
      const point = this.G.mul(privKey);

      return {
        x: point.getX(),
        y: point.getY(),
      };
    } catch (error) {
      console.error("Error in hashToPoint:", error);
      throw new Error("Failed to hash input to curve point");
    }
  }

  private static validatePoint(point: ECPoint): boolean {
    try {
      // Basic range check
      if (point.x.gte(this.p) || point.y.gte(this.p)) {
        return false;
      }

      // Verify point satisfies curve equation y² = x³ + 7
      const y2 = point.y.mul(point.y).mod(this.p);
      const x3 = point.x.pow(new BN(3)).mod(this.p);
      const rhs = x3.add(new BN(7)).mod(this.p);

      if (!y2.eq(rhs)) {
        return false;
      }

      // Additional validation using elliptic library
      const ecPoint = this.curve.point(point.x, point.y);
      return this.curve.validate(ecPoint);
    } catch {
      return false;
    }
  }

  private static pointToBytes(point: ECPoint): Uint8Array {
    try {
      if (!point || !point.x || !point.y) {
        throw new Error("Invalid point structure");
      }

      // Ensure we have BN instances
      const x = BN.isBN(point.x) ? point.x : new BN(point.x);
      const y = BN.isBN(point.y) ? point.y : new BN(point.y);

      // Convert to fixed-length byte arrays
      const xHex = x.toString(16, 64); // Pad to 32 bytes
      const yHex = y.toString(16, 64);

      // Convert hex strings to Uint8Array
      const xBytes = Buffer.from(xHex, "hex");
      const yBytes = Buffer.from(yHex, "hex");

      return new Uint8Array([...xBytes, ...yBytes]);
    } catch (error) {
      console.error("Error in pointToBytes:", error);
      throw error;
    }
  }

  private static scalarMult(point: ECPoint, scalar: BN): ECPoint {
    try {
      const ecPoint = this.curve.point(point.x, point.y);
      const result = ecPoint.mul(scalar);

      return {
        x: result.getX(),
        y: result.getY(),
      };
    } catch (error) {
      console.error("Error in scalar multiplication:", error);
      throw error;
    }
  }

  private static pointAdd(p1: ECPoint, p2: ECPoint): ECPoint {
    try {
      // console.log("➕ POINT ADDITION:");
      // console.log("  - P1:", this.utils.pointToHex(p1));
      // console.log("  - P2:", this.utils.pointToHex(p2));

      const point1 = this.curve.point(p1.x, p1.y);
      const point2 = this.curve.point(p2.x, p2.y);
      const sum = point1.add(point2);

      const result = {
        x: sum.getX(),
        y: sum.getY(),
      };
      
      // console.log("  - RESULT:", this.utils.pointToHex(result));
      return result;
    } catch (error) {
      console.error("❌ ERROR in point addition:", error);
      throw error;
    }
  }

  static async createKeyImage(
    privateKey: BN,
    publicKeys: ECPoint[],
    caseIdentifier: Uint8Array
  ): Promise<ECPoint> {
    // console.log("🔑 Starting key image generation...");
    // console.log("Input data:", {
    //   privateKeyHex: privateKey.toString("hex"),
    //   numPublicKeys: publicKeys.length,
    //   caseIdLength: caseIdentifier.length,
    // });

    try {
      // Hash public keys
      // console.log("📊 Hashing public keys...");
      const pubKeysBytes = publicKeys.map((pk) => this.pointToBytes(pk));
      // console.log(
      //   "Public keys bytes length:",
      //   pubKeysBytes.map((b) => b.length)
      // );

      const pubKeysDigest = new Uint8Array(
        sha3_256.array(
          Buffer.concat(pubKeysBytes.map((bytes) => Buffer.from(bytes)))
        )
      );
      // console.log("Public keys digest length:", pubKeysDigest.length);
      // console.log("Public keys digest:", Buffer.from(pubKeysDigest).toString('hex'));

      // Create base point input
      // console.log("🎯 Creating base point input...");
      const basePointInput = Buffer.concat([
        Buffer.from(pubKeysDigest),
        Buffer.from(caseIdentifier),
      ]);
      // console.log("Base point input length:", basePointInput.length);
      // console.log("Base point input hex:", basePointInput.toString('hex'));

      // Hash to point
      // console.log("📍 Hashing to curve point...");
      const h = await this.hashToPoint(basePointInput);
      // console.log("Generated base point:", {
      //   x: h.x.toString("hex"),
      //   y: h.y.toString("hex"),
      // });

      // Multiply by private key
      // console.log("✖️ Performing scalar multiplication...");
      const keyImage = this.scalarMult(h, privateKey);
      // console.log("Generated key image:", {
      //   x: keyImage.x.toString("hex"),
      //   y: keyImage.y.toString("hex"),
      // });

      if (!this.validatePoint(keyImage)) {
        throw new Error("Generated key image is not a valid curve point");
      }

      if (!BN.isBN(keyImage.x) || !BN.isBN(keyImage.y)) {
        throw new Error("Key image coordinates not BN instances");
      }

      return keyImage;
    } catch (error) {
      console.error("❌ Error in key image generation:", error);
      throw error;
    }
  }

  static async createRingSignature(
    message: Uint8Array,
    publicKeys: ECPoint[],
    privateKey: BN,
    signerIndex: number,
    caseIdentifier: Uint8Array
  ): Promise<RingSignature> {
    try {
      // console.log("🔏 CREATE RING SIGNATURE - Starting");
      // console.log("  - Message length:", message.length);
      // console.log("  - Message hash:", Buffer.from(sha3_256.array(message)).toString('hex'));
      // console.log("  - Number of public keys:", publicKeys.length);
      // console.log("  - Signer index:", signerIndex);
      // console.log("  - Case identifier:", Buffer.from(caseIdentifier).toString('hex'));
      
      // Validate inputs
      if (!message || !publicKeys || !privateKey || signerIndex < 0) {
        throw new Error("Invalid input parameters");
      }
  
      // Validate all public keys
      publicKeys.forEach((pk, idx) => {
        if (!this.validatePoint(pk)) {
          throw new Error(`Invalid public key at index ${idx}`);
        }
      });
  
      const n = publicKeys.length;
      if (n < 2) throw new Error("Ring size must be at least 2");
      if (signerIndex >= n) throw new Error("Invalid signer index");
  
      // Create key image
      // console.log("🔑 Creating key image...");
      const keyImage = await this.createKeyImage(
        privateKey,
        publicKeys,
        caseIdentifier
      );
      // console.log("Key image:", this.utils.pointToHex(keyImage));
      
      if (!this.validatePoint(keyImage)) {
        throw new Error("Invalid key image generated");
      }
  
      // Get public keys digest
      // console.log("📝 Calculating public keys digest...");
      const pubKeysBytes = publicKeys.map((pk) => this.pointToBytes(pk));
      const pubKeysDigest = new Uint8Array(
        sha3_256.array(
          Buffer.concat(pubKeysBytes.map((bytes) => Buffer.from(bytes)))
        )
      );
      // console.log("Public keys digest:", Buffer.from(pubKeysDigest).toString('hex'));
  
      // Hash message
      // console.log("📝 Hashing message...");
      const messageDigest = new Uint8Array(sha3_256.array(message));
      // console.log("Message digest:", Buffer.from(messageDigest).toString('hex'));
  
      // Initialize arrays
      const signatures: Uint8Array[] = new Array(n);
      const c: Uint8Array[] = new Array(n);
  
      // Step 1: Generate random scalar u and start from signer's position
      // console.log("🎲 Generating random scalar u...");
      const u = new BN(ec.genKeyPair().getPrivate().toArray());
      // console.log("Random scalar u:", u.toString(16));
  
      // Get base point h
      // console.log("📌 Calculating base point h...");
      const basePointInput = Buffer.concat([
        Buffer.from(pubKeysDigest),
        Buffer.from(caseIdentifier),
      ]);
      const h = await this.hashToPoint(basePointInput);
      // console.log("Base point h:", this.utils.pointToHex(h));
  
      // Step 2: Calculate c[π+1]
      // console.log("🧮 Calculating initial commitments at signer's position...");
      // Generate commitments at signer's position
      const commitment1 = this.scalarMult(this.G, u);
      // console.log("Commitment1 (G*u):", this.utils.pointToHex(commitment1));
      
      const commitment2 = this.scalarMult(h, u);
      // console.log("Commitment2 (h*u):", this.utils.pointToHex(commitment2));
  
      // Start the ring at (signerIndex + 1) % n
      const nextIndex = (signerIndex + 1) % n;
      // console.log(`🔄 Starting ring at index ${nextIndex}...`);
      
      c[nextIndex] = await this.getSignatureDigest(
        pubKeysDigest,
        keyImage,
        messageDigest,
        commitment1,
        commitment2
      );
      // console.log(`Challenge c[${nextIndex}]:`, this.utils.bytesToHex(c[nextIndex]));
  
      // Step 3: Go around the ring starting from (signerIndex + 1)
      // console.log("🔄 Going around the ring...");
      for (let j = 1; j < n; j++) {
        // Calculate current index in the ring
        const i = (signerIndex + j) % n;
        // console.log(`\n📍 Ring position ${j}, index ${i}:`);
        
        // Generate random signature for this position
        const randKeyPair = ec.genKeyPair();
        const si = new BN(randKeyPair.getPrivate().toArray());
        signatures[i] = Buffer.from(si.toArray('be', 32));
        // console.log(`Signature s[${i}]:`, si.toString(16));
  
        // Calculate the next commitment points
        // console.log(`Calculating commitments for index ${i}...`);
        // console.log(`- Using c[${i}]:`, this.utils.bytesToHex(c[i]));
        
        const term1 = this.scalarMult(this.G, si);
        // console.log("- Term1 (G*s):", this.utils.pointToHex(term1));
        
        const term2 = this.scalarMult(publicKeys[i], new BN(c[i]));
        // console.log("- Term2 (P*c):", this.utils.pointToHex(term2));
        
        const nextCommitment1 = this.pointAdd(term1, term2);
        // console.log("- NextCommitment1 (G*s + P*c):", this.utils.pointToHex(nextCommitment1));
  
        const term3 = this.scalarMult(h, si);
        // console.log("- Term3 (h*s):", this.utils.pointToHex(term3));
        
        const term4 = this.scalarMult(keyImage, new BN(c[i]));
        // console.log("- Term4 (I*c):", this.utils.pointToHex(term4));
        
        const nextCommitment2 = this.pointAdd(term3, term4);
        // console.log("- NextCommitment2 (h*s + I*c):", this.utils.pointToHex(nextCommitment2));
  
        // Calculate the next challenge 
        const nextPos = (i + 1) % n;
        c[nextPos] = await this.getSignatureDigest(
          pubKeysDigest,
          keyImage,
          messageDigest,
          nextCommitment1,
          nextCommitment2
        );
        // console.log(`- Next challenge c[${nextPos}]:`, this.utils.bytesToHex(c[nextPos]));
      }
  
      // Step 4: Close the ring by calculating the signer's signature
      // console.log("\n🔒 Closing the ring by calculating signer's signature...");
      // console.log(`- Using challenge c[${signerIndex}]:`, this.utils.bytesToHex(c[signerIndex]));
      
      const signerChallenge = new BN(c[signerIndex]);
      // console.log("- Signer challe/nge as BN:", signerChallenge.toString(16));
      // 
      const privateKeyMulChallenge = privateKey.mul(signerChallenge).mod(this.n);
      // console.log("- privateKey * challenge:", privateKeyMulChallenge.toString(16));
      
      const s = u.sub(privateKeyMulChallenge).mod(this.n);
      // console.log(`- Final signature s[${signerIndex}] (u - privateKey*c):`, s.toString(16));
      
      signatures[signerIndex] = Buffer.from(s.toArray('be', 32));
  
      // console.log("\n✅ Ring signature creation complete");
      // console.log("- Final checksum (c[0]):", this.utils.bytesToHex(c[0]));
      // console.log("- All signatures:");
      signatures.forEach((sig, idx) => {
        // console.log(`  s[${idx}]:`, Buffer.from(sig).toString('hex'));
      });
      
      return {
        keyImage,
        checksum: c[0], // The checksum is always c[0]
        signatures,
      };
    } catch (error) {
      console.error("❌ ERROR in createRingSignature:", error);
      throw error;
    }
  }
  
  static async verifyRingSignature(
    message: Uint8Array,
    publicKeys: ECPoint[],
    signature: RingSignature,
    caseIdentifier: Uint8Array
  ): Promise<boolean> {
    try {
      // console.log("🔍 VERIFY RING SIGNATURE - Starting verification process...");
      // console.log("- Message length:", message.length);
      // console.log("- Message hash:", Buffer.from(sha3_256.array(message)).toString('hex'));
      // console.log("- Number of public keys:", publicKeys.length);
      // console.log("- Number of signatures:", signature.signatures.length);
      // console.log("- Key image:", this.utils.pointToHex(signature.keyImage));
      // console.log("- Checksum:", this.utils.bytesToHex(signature.checksum));
      // console.log("- Case identifier length:", caseIdentifier.length);
      
      // Input validation
      if (!message || !publicKeys || !signature || !caseIdentifier) {
        throw new Error("Missing required parameters");
      }
      
      const n = publicKeys.length;
      if (n < 2 || n !== signature.signatures.length) {
        throw new Error("Invalid ring size or signature count mismatch");
      }
  
      // Compute public keys digest
      // console.log("📝 Computing public keys digest...");
      const pubKeysBytes = publicKeys.map((pk) => this.pointToBytes(pk));
      const pubKeysDigest = new Uint8Array(
        sha3_256.array(
          Buffer.concat(pubKeysBytes.map((bytes) => Buffer.from(bytes)))
        )
      );
      // console.log("- Public keys digest:", Buffer.from(pubKeysDigest).toString('hex'));
      
      // Compute message digest
      // console.log("📝 Computing message digest...");
      const messageDigest = new Uint8Array(sha3_256.array(message));
      // console.log("- Message digest:", Buffer.from(messageDigest).toString('hex'));
      
      // Get base point H
      // console.log("📌 Computing base point H...");
      const basePointInput = Buffer.concat([
        Buffer.from(pubKeysDigest),
        Buffer.from(caseIdentifier)
      ]);
      // console.log("- Base point input:", basePointInput.toString('hex'));
      
      const h = await this.hashToPoint(basePointInput);
      // console.log("- Base point H:", this.utils.pointToHex(h));
  
      // Initialize verification with the checksum
      const challenges: Uint8Array[] = new Array(n);
      challenges[0] = signature.checksum;
      // console.log("\n🔄 Starting verification loop with initial checksum:", this.utils.bytesToHex(challenges[0]));
  
      // Verify the ring signature - always start from index 0
      for (let i = 0; i < n; i++) {
        // console.log(`\n📍 Verifying ring position ${i}:`);
        
        const s = new BN(signature.signatures[i]);
        // console.log(`- Signature s[${i}]:`, s.toString(16));
        
        const c = new BN(challenges[i]);
        // console.log(`- Challenge c[${i}]:`, c.toString(16));
  
        // Calculate G*s
        // console.log("- Calculating G*s...");
        const gs = this.scalarMult(this.G, s);
        // console.log("  G*s =", this.utils.pointToHex(gs));
        
        // Calculate P*c
        // console.log(`- Calculating P[${i}]*c...`);
        // console.log(`  Using public key:`, this.utils.pointToHex(publicKeys[i]));
        const pc = this.scalarMult(publicKeys[i], c);
        // console.log(`  P[${i}]*c =`, this.utils.pointToHex(pc));
        
        // Calculate commitment1 = G*s + P*c
        // console.log("- Calculating commitment1 = G*s + P*c...");
        const commitment1 = this.pointAdd(gs, pc);
        // console.log("  Commitment1 =", this.utils.pointToHex(commitment1));
  
        // Calculate H*s
        // console.log("- Calculating H*s...");
        const hs = this.scalarMult(h, s);
        // console.log("  H*s =", this.utils.pointToHex(hs));
        
        // Calculate I*c (I is the key image)
        // console.log("- Calculating I*c...");
        const ic = this.scalarMult(signature.keyImage, c);
        // console.log("  I*c =", this.utils.pointToHex(ic));
        
        // Calculate commitment2 = H*s + I*c
        // console.log("- Calculating commitment2 = H*s + I*c...");
        const commitment2 = this.pointAdd(hs, ic);
        // console.log("  Commitment2 =", this.utils.pointToHex(commitment2));
  
        // For all indices except the last one, calculate next challenge
        if (i < n - 1) {
          // console.log(`- Calculating next challenge c[${i+1}]...`);
          challenges[i + 1] = await this.getSignatureDigest(
            pubKeysDigest,
            signature.keyImage,
            messageDigest,
            commitment1,
            commitment2
          );
          // console.log(`  c[${i+1}] =`, this.utils.bytesToHex(challenges[i + 1]));
        } else {
          // For the last index, calculate the final challenge and compare
          // console.log("- Calculating final challenge...");
          const finalChallenge = await this.getSignatureDigest(
            pubKeysDigest,
            signature.keyImage,
            messageDigest,
            commitment1,
            commitment2
          );
          // console.log("  Final challenge:", this.utils.bytesToHex(finalChallenge));
          // console.log("  Original checksum:", this.utils.bytesToHex(signature.checksum));
  
          // Compare with original checksum - ring is verified if they match
          const isValid = Buffer.from(finalChallenge).equals(Buffer.from(signature.checksum));
          // console.log(`\n✅ VERIFICATION RESULT: ${isValid ? "VALID" : "INVALID"} SIGNATURE`);
          
          if (!isValid) {
            console.log("❌ CHECKSUM MISMATCH!");
            console.log("- Final calculated checksum:", this.utils.bytesToHex(finalChallenge));
            console.log("- Original checksum:", this.utils.bytesToHex(signature.checksum));
          }
          
          return isValid;
        }
      }
  
      console.log("❌ Verification loop completed without final check!");
      return false;
    } catch (error) {
      console.error("❌ ERROR in verifyRingSignature:", error);
      throw error;
    }
  }
  
  private static async getSignatureDigest(
    publicKeysDigest: Uint8Array,
    keyImage: ECPoint,
    messageDigest: Uint8Array,
    commitmentPoint1: ECPoint,
    commitmentPoint2: ECPoint
  ): Promise<Uint8Array> {
    try {
      // console.log("📝 GET SIGNATURE DIGEST - Inputs:");
      // console.log("- Public keys digest:", Buffer.from(publicKeysDigest).toString('hex'));
      // console.log("- Key image:", this.utils.pointToHex(keyImage));
      // console.log("- Message digest:", Buffer.from(messageDigest).toString('hex'));
      // console.log("- Commitment point 1:", this.utils.pointToHex(commitmentPoint1));
      // console.log("- Commitment point 2:", this.utils.pointToHex(commitmentPoint2));
  
      // Ensure consistent byte length for all components
      const keyImageBytes = Buffer.concat([
        Buffer.from(keyImage.x.toArray('be', 32)),
        Buffer.from(keyImage.y.toArray('be', 32))
      ]);
      // console.log("- Key image bytes:", keyImageBytes.toString('hex'));
  
      const commitment1Bytes = Buffer.concat([
        Buffer.from(commitmentPoint1.x.toArray('be', 32)),
        Buffer.from(commitmentPoint1.y.toArray('be', 32))
      ]);
      // console.log("- Commitment1 bytes:", commitment1Bytes.toString('hex'));
  
      const commitment2Bytes = Buffer.concat([
        Buffer.from(commitmentPoint2.x.toArray('be', 32)),
        Buffer.from(commitmentPoint2.y.toArray('be', 32))
      ]);
      // console.log("- Commitment2 bytes:", commitment2Bytes.toString('hex'));
  
      // Concatenate all components in fixed order (match Go implementation)
      const buffer = Buffer.concat([
        Buffer.from(publicKeysDigest),
        keyImageBytes,
        commitment1Bytes,
        commitment2Bytes,
        Buffer.from(messageDigest)
      ]);
      
      //buffer order must match the original order like go implemetation , 
      
      // console.log("- Complete buffer length:", buffer.length);
      // console.log("- Complete buffer hex:", buffer.toString('hex').substring(0, 100) + "...");
  
      // Create final hash
      const digest = new Uint8Array(sha3_256.array(buffer));
      // console.log("- Final digest:", Buffer.from(digest).toString('hex'));
      
      return digest;
    } catch (error) {
      console.error("❌ ERROR in getSignatureDigest:", error);
      throw error;
    }
  }

  
}