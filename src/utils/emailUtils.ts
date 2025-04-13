// src/utils/emailUtils.ts

import nodemailer from "nodemailer";
import { isAdmin } from "@/config/admin";

interface Certificate {
    userPublicKey: string;
    electionAuthorityPublicKey: string;
    signature: string;
  }
  
  interface KeyData {
    publicKey: string;
    privateKey: string;
    certificate: Certificate | string; // Can be either a Certificate object or its string representation
    digest?: string;
    keyCoordinate?: string;
  }

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});
export type VerificationType = "login" | "generation" | "deploy";

const getVerificationSubject = (
  type: VerificationType,
  email: string
): string => {
  const baseSubject = "IIT-Bhilai E-Voting Project - ";

  switch (type) {
    case "login":
      return isAdmin(email)
        ? `${baseSubject}Admin Login Verification`
        : `${baseSubject}Login Verification`;
    case "generation":
      return `${baseSubject}Key Generation Verification`;
    case "deploy":
      return `${baseSubject}Admin Contract Redeploy Verification`;
    default:
      return `${baseSubject}Verification`;
  }
};
const getVerificationMessage = (type: VerificationType): string => {
  switch (type) {
    case "login":
      return "to complete your login process";
    case "generation":
      return "to proceed with key generation";
    case "deploy":
      return "to confirm contract redeployment";
    default:
      return "to verify your request"; // Default case
  }
};

export async function sendVerificationCode(
  email: string,
  code: string,
  type: VerificationType
): Promise<boolean> {
  try {
    console.log("Verification type:", type);
    const subject = getVerificationSubject(type, email);
    console.log("Email subject:", subject);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: getVerificationSubject(type, email),
      html: `
                <div style="
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    background-color: #f8fafc;
                    padding: 2rem;
                    max-width: 600px;
                    margin: auto;
                ">
                    <!-- Header with Logo -->
                    <div style="
                        text-align: center;
                        margin-bottom: 2rem;
                    ">
                        <div style="
                            display: inline-block;
                            background-color: #1e40af;
                            color: #ffffff;
                            padding: 0.75rem 1.5rem;
                            border-radius: 0.375rem;
                            font-size: 1.25rem;
                            font-weight: 600;
                        ">
                            Blockchain E-Voting System
                        </div>
                    </div>

                    <!-- Main Content -->
                    <div style="
                        background-color: #ffffff;
                        border-radius: 0.5rem;
                        padding: 2rem;
                        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                    ">
                        <h1 style="
                            color: #1e3a8a;
                            font-size: 1.5rem;
                            font-weight: 600;
                            text-align: center;
                            margin-bottom: 1.5rem;
                        ">
                            ${
                              type.charAt(0).toUpperCase() + type.slice(1)
                            } Verification Required
                        </h1>

                        <p style="
                            color: #334155;
                            font-size: 1rem;
                            line-height: 1.625;
                            margin-bottom: 1.5rem;
                        ">
                            Dear User,
                        </p>

                        <p style="
                            color: #334155;
                            font-size: 1rem;
                            line-height: 1.625;
                            margin-bottom: 1.5rem;
                        ">
                            Please use the verification code below ${getVerificationMessage(
                              type
                            )}:
                        </p>

                        <!-- Verification Code Box -->
                        <div style="
                            background-color: #f1f5f9;
                            border: 1px solid #cbd5e1;
                            border-radius: 0.375rem;
                            padding: 1.25rem;
                            margin: 1.5rem 0;
                            text-align: center;
                        ">
                            <div style="
                                color: #1e40af;
                                font-family: 'Courier New', monospace;
                                font-size: 1.875rem;
                                font-weight: 600;
                                letter-spacing: 0.1em;
                            ">
                                ${code}
                            </div>
                        </div>

                        <p style="
                            color: #64748b;
                            font-size: 0.875rem;
                            text-align: center;
                            margin-top: 1rem;
                        ">
                            This verification code will expire in 10 minutes for security purposes.
                        </p>

                        <p style="
                            color: #334155;
                            font-size: 1rem;
                            line-height: 1.625;
                            margin-top: 1.5rem;
                        ">
                            If you did not request this verification code, please disregard this email.
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style="
                        margin-top: 2rem;
                        text-align: center;
                        color: #64748b;
                    ">
                        <p style="
                            font-size: 0.875rem;
                            margin-bottom: 1rem;
                        ">
                            For more info, please contact Dr. Souradyuti Paul, Head of CSE Department and Project Administrator.<br>
                            <div>
                            <div style="color: #1e40af;">Emails: souradyuti@iitbhilai.ac.in</div>
                            </div>
                        </p>

                        <div style="
                            border-top: 1px solid #e2e8f0;
                            padding-top: 1rem;
                            margin-top: 1rem;
                            font-size: 0.75rem;
                        ">
                            © 2025 IIT-Bhilai E-Voting System<br>
                            This is an automated message, please do not reply to this email.
                        </div>
                    </div>
                </div>
            `,
    });

    return true;
  } catch (error) {
    console.error("Send verification email error:", error);
    return false;
  }
}

export async function sendKeys(email: string, keys: KeyData): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "[IMPORTANT] Your E-Voting Keys - Secure Information",
      html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1a73e8;">Your E-Voting Keys - Important Information</h2>
                    
                    <div style="background-color: #fef3f3; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
                        <h3 style="color: #dc3545; margin-top: 0;">⚠️ CRITICAL SECURITY WARNINGS</h3>
                        <ul style="color: #dc3545; margin: 10px 0;">
                            <li>Never share your private key with anyone, including election officials or IT support.</li>
                            <li>Do not store these keys in cloud services or public locations.</li>
                            <li>Keep a secure backup of these keys - losing them means you cannot vote.</li>
                            <li>Be aware of phishing attempts - we will never ask for your private key via email or messages.</li>
                        </ul>
                    </div>

                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #1a73e8;">Recommended Security Practices:</h3>
                        <ul>
                            <li>Store your keys in an encrypted file or password manager</li>
                            <li>If you write them down, keep them in a secure, private location</li>
                            <li>Do not take screenshots or photos of these keys</li>
                            <li>Use a secure device when accessing these credentials</li>
                        </ul>
                    </div>

                    <div style="margin: 20px 0;">
                        <h3>Your Public Key:</h3>
                        <pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; overflow-wrap: break-word;">${
                          keys.publicKey
                        }</pre>
                        
                        <h3>Your Private Key:</h3>
                        <div style="background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; margin: 5px 0;">
                            ⚠️ This is your private key. Never share this with anyone.
                        </div>
                        <pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; overflow-wrap: break-word;">${
                          keys.privateKey
                        }</pre>
                        
                        ${
                            keys.certificate
                              ? `
                              <h3>Registration Certificate</h3>
                              <div style="
                                  background-color: #f8f9fa;
                                  border: 1px solid #dee2e6;
                                  border-radius: 8px;
                                  padding: 20px;
                                  margin: 20px 0;
                              ">
                                  <div style="margin-bottom: 20px;">
                                      <h4 style="
                                          color: #1a73e8;
                                          margin: 0 0 10px 0;
                                          font-size: 16px;
                                      ">User Public Key</h4>
                                      <pre style="
                                          background-color: #f5f5f5;
                                          padding: 15px;
                                          border-radius: 5px;
                                          overflow-wrap: break-word;
                                          margin: 0;
                                          font-size: 14px;
                                          white-space: pre-wrap;
                                      ">${typeof keys.certificate === 'string' 
                                          ? JSON.parse(keys.certificate).userPublicKey 
                                          : keys.certificate.userPublicKey}</pre>
                                  </div>
                          
                                  <div style="margin-bottom: 20px;">
                                      <h4 style="
                                          color: #1a73e8;
                                          margin: 0 0 10px 0;
                                          font-size: 16px;
                                      ">Election Authority Public Key</h4>
                                      <pre style="
                                          background-color: #f5f5f5;
                                          padding: 15px;
                                          border-radius: 5px;
                                          overflow-wrap: break-word;
                                          margin: 0;
                                          font-size: 14px;
                                          white-space: pre-wrap;
                                      ">${typeof keys.certificate === 'string' 
                                          ? JSON.parse(keys.certificate).electionAuthorityPublicKey 
                                          : keys.certificate.electionAuthorityPublicKey}</pre>
                                  </div>
                          
                                  <div>
                                      <h4 style="
                                          color: #1a73e8;
                                          margin: 0 0 10px 0;
                                          font-size: 16px;
                                      ">Signature</h4>
                                      <pre style="
                                          background-color: #f5f5f5;
                                          padding: 15px;
                                          border-radius: 5px;
                                          overflow-wrap: break-word;
                                          margin: 0;
                                          font-size: 14px;
                                          white-space: pre-wrap;
                                      ">${typeof keys.certificate === 'string' 
                                          ? JSON.parse(keys.certificate).signature 
                                          : keys.certificate.signature}</pre>
                                  </div>
                              </div>
                              `
                              : ""
                          }
  
                        ${
                          keys.digest
                            ? `
                        <h3>Key Digest:</h3>
                        <pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; overflow-wrap: break-word;">${keys.digest}</pre>
                        `
                            : ""
                        }
                        
                        ${
                          keys.keyCoordinate
                            ? `
                        <h3>Key Coordinates:</h3>
                        <pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; overflow-wrap: break-word;">${keys.keyCoordinate}</pre>
                        `
                            : ""
                        }
                    </div>

                    <div style="background-color: #e8f5e9; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
                        <h3 style="color: #28a745; margin-top: 0;">Important Reminders</h3>
                        <ul>
                            <li>Download and securely store these credentials immediately</li>
                            <li>You will need both keys to participate in the voting process</li>
                            <li>Lost keys cannot be recovered or replaced</li>
                            <li>Report any suspicious activities related to your voting credentials immediately</li>
                        </ul>
                    </div>

                    <div style="
                        margin-top: 2rem;
                        text-align: center;
                        color: #64748b;
                    ">
                        <p style="
                            font-size: 0.875rem;
                            margin-bottom: 1rem;
                        ">
                            For more info, please contact Dr. Souradyuti Paul, Head of CSE Department and Project Administrator.<br>
                            <span style="color: #1e40af;">Email: souradyuti@iitbhilai.ac.in</span>
                        </p>

                        <div style="
                            border-top: 1px solid #e2e8f0;
                            padding-top: 1rem;
                            margin-top: 1rem;
                            font-size: 0.75rem;
                        ">
                            © 2025 IIT-Bhilai E-Voting System<br>
                            This is an automated message, please do not reply to this email.
                        </div>
                    </div>
                </div>
            `,
    });
    return true;
  } catch (error) {
    console.error("Send keys email error:", error);
    return false;
  }
}
