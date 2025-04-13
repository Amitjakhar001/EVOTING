// src/components/PhaseTime.tsx

import { FC } from 'react';
import React, { useEffect, useState } from 'react';
import { getContract } from '@/utils/blockchainUtils';

interface PhaseTimeProps {
    currentPhaser: VotingPhase;
}

// Define phases as an enum for better type safety
export enum VotingPhase {
    REGISTRATION = 'REGISTRATION',
    SUBMISSION = 'SUBMISSION',
    VOTING = 'VOTING',
    ENDED = 'ENDED'
}

const PhaseTime: FC<PhaseTimeProps> = ({ currentPhaser }) => {
    const [timeLeft, setTimeLeft] = useState<{
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
    } | null>(null);
    const [currentPhase, setCurrentPhase] = useState<VotingPhase>(currentPhaser);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let timerInterval: NodeJS.Timeout;

        const fetchPhaseAndTime = async () => {
            try {
                setError(null);
                const contract = await getContract();
                const currentTime = BigInt(Math.floor(Date.now() / 1000));
                const registrationEndTime = await contract.registrationEndTime();
                const submissionEndTime = await contract.submissionEndTime();
                const votingEndTime = await contract.votingEndTime();

                // Clear any existing interval
                if (timerInterval) {
                    clearInterval(timerInterval);
                }

                // Determine current phase and target time
                if (currentTime >= votingEndTime) {
                    setCurrentPhase(VotingPhase.ENDED);
                    setTimeLeft(null);
                } else if (currentTime >= submissionEndTime) {
                    setCurrentPhase(VotingPhase.VOTING);
                    timerInterval = updateTimeLeft(votingEndTime);
                } else if (currentTime >= registrationEndTime) {
                    setCurrentPhase(VotingPhase.SUBMISSION);
                    timerInterval = updateTimeLeft(submissionEndTime);
                } else {
                    setCurrentPhase(VotingPhase.REGISTRATION);
                    timerInterval = updateTimeLeft(registrationEndTime);
                }
            } catch (err) {
                console.error('Error fetching phase times:', err);
                setError('Unable to fetch phase times. Please try again later.');
            }
        };

        fetchPhaseAndTime();
        const phaseCheckInterval = setInterval(fetchPhaseAndTime, 60000);

        return () => {
            clearInterval(phaseCheckInterval);
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        };
    }, []);

    const updateTimeLeft = (endTime: bigint): NodeJS.Timeout => {
        const calculateTimeLeft = () => {
            const now = BigInt(Math.floor(Date.now() / 1000));
            const diff = endTime - now;

            if (diff <= 0n) {
                setTimeLeft(null);
                // Trigger a phase check when time expires
                fetchPhaseAndTime();
                return false;
            }

            const diffNumber = Number(diff);
            const days = Math.floor(diffNumber / (24 * 60 * 60));
            const hours = Math.floor((diffNumber % (24 * 60 * 60)) / (60 * 60));
            const minutes = Math.floor((diffNumber % (60 * 60)) / 60);
            const seconds = diffNumber % 60;

            setTimeLeft({ days, hours, minutes, seconds });
            return true;
        };

        // Initial calculation
        calculateTimeLeft();

        // Set up interval
        const interval = setInterval(() => {
            const shouldContinue = calculateTimeLeft();
            if (!shouldContinue) {
                clearInterval(interval);
            }
        }, 1000);

        return interval;
    };

    const fetchPhaseAndTime = async () => {
        const contract = await getContract();
        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        const registrationEndTime = await contract.registrationEndTime();
        const submissionEndTime = await contract.submissionEndTime();
        const votingEndTime = await contract.votingEndTime();

        if (currentTime >= votingEndTime) {
            setCurrentPhase(VotingPhase.ENDED);
            setTimeLeft(null);
        } else if (currentTime >= submissionEndTime) {
            setCurrentPhase(VotingPhase.VOTING);
            updateTimeLeft(votingEndTime);
        } else if (currentTime >= registrationEndTime) {
            setCurrentPhase(VotingPhase.SUBMISSION);
            updateTimeLeft(submissionEndTime);
        } else {
            setCurrentPhase(VotingPhase.REGISTRATION);
            updateTimeLeft(registrationEndTime);
        }
    };

    if (currentPhase === VotingPhase.ENDED) {
        return (
            <div className="bg-gray-100 border border-gray-400 text-gray-700 px-4 py-3 rounded">
                Voting has ended
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                {error}
            </div>
        );
    }

    if (!timeLeft) {
        return (
            <div className="animate-pulse bg-gray-100 p-4 rounded">
                Loading phase information...
            </div>
        );
    }

    let containerClasses, titleClasses, numberClasses, phaseName;
    
    switch (currentPhase) {
        case VotingPhase.REGISTRATION:
            containerClasses = "bg-blue-50 border border-blue-200";
            titleClasses = "text-blue-800";
            numberClasses = "text-blue-600";
            phaseName = "Registration";
            break;
        case VotingPhase.SUBMISSION:
            containerClasses = "bg-purple-50 border border-purple-200";
            titleClasses = "text-purple-800";
            numberClasses = "text-purple-600";
            phaseName = "Public Key Submission";
            break;
        case VotingPhase.VOTING:
            containerClasses = "bg-green-50 border border-green-200";
            titleClasses = "text-green-800";
            numberClasses = "text-green-600";
            phaseName = "Voting";
            break;
        default:
            containerClasses = "bg-gray-50 border border-gray-200";
            titleClasses = "text-gray-800";
            numberClasses = "text-gray-600";
            phaseName = "Unknown";
    }

    return (
        <div className={`${containerClasses} rounded-lg p-4 mb-6`}>
            <h3 className={`text-lg font-semibold ${titleClasses} mb-2`}>
                {phaseName} Time Remaining
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white p-2 rounded shadow">
                    <div className={`text-2xl font-bold ${numberClasses}`}>{timeLeft.days}</div>
                    <div className="text-sm text-gray-600">Days</div>
                </div>
                <div className="bg-white p-2 rounded shadow">
                    <div className={`text-2xl font-bold ${numberClasses}`}>{timeLeft.hours}</div>
                    <div className="text-sm text-gray-600">Hours</div>
                </div>
                <div className="bg-white p-2 rounded shadow">
                    <div className={`text-2xl font-bold ${numberClasses}`}>{timeLeft.minutes}</div>
                    <div className="text-sm text-gray-600">Minutes</div>
                </div>
                <div className="bg-white p-2 rounded shadow">
                    <div className={`text-2xl font-bold ${numberClasses}`}>{timeLeft.seconds}</div>
                    <div className="text-sm text-gray-600">Seconds</div>
                </div>
            </div>
        </div>
    );
};

export default PhaseTime;