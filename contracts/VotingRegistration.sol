// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VotingRegistration {
    uint256 public constant MINIMUM_BALANCE = 0.2 ether;  //0.2 tBNB
    uint256 public immutable registrationStartTime;
    uint256 public immutable registrationEndTime;
    uint256 public immutable submissionEndTime;
    uint256 public immutable votingEndTime;
    string[] private allowedDomains;
    address public immutable admin;
    string public constant CASE_ID = "evoting2025";

    address public constant ELECTION_AUTHORITY = 0xcE8190E1Ebe1Bce6c6685ae4B2f9eeE1FaA906E0; 
    string public constant ELECTION_AUTHORITY_PUBLIC_KEY = "0x02e38bd1eb64f92d612c0099cd14895cbaea476eff711de49fb15d3a13f11bcce5";

    struct VoterData {
        bool hasGeneratedKeys;        
        bytes32 publicKeyHash;
        bytes32 emailHash;
        bytes32 signatureHash;
    }
    
    struct VotingKeySubmission {
        bool isUsed;                    
        string votingPublicKey;         
        bytes32 ringSignatureHash;    
        bytes32 keyImageHash;  
        address voterAddress;       
    }
    
    mapping(bytes32 => bool) private usedKeyImages;
    mapping(string => VoterData) private voterData;
    mapping(uint256 => string) private registeredEmails;
    mapping(string => string) private voterEAPublicKeys;

    VotingKeySubmission[] public votingKeySubmissions;
    mapping(string => uint256) private votingKeySubmissionIndex;  
    uint256 private emailCount;
    
    struct Candidate {
        string name;
        uint256 voteCount;
    }
    
    Candidate[] public candidates;
    mapping(string => uint256) private candidateIndex;
    
    event KeysGenerated(string email, string publicKey);
    event VotingKeySubmitted(string votingPublicKey);  
    event VoteCast(string candidate);
    event RegistrationEnded();
    event SubmissionEnded();
    event VotingEnded();
    event ResultPhaseStarted();

    error InvalidEmailDomain();
    error EmailAlreadyRegistered();
    error InvalidSignatureLength();
    error InvalidSignature();
    error SignerNotAuthorized();
    error InsufficientFunds(uint256 required, uint256 available);
    error KeyImageAlreadyUsed();
    error InvalidRingSignature();
    error RegistrationPeriodEnded();
    error SubmissionPeriodNotActive();
    error VotingPeriodNotActive();
    error InvalidCandidate();
    error VotingKeyAlreadyUsed();
    error EmailNotRegistered();

    function hasGeneratedKeys(string calldata email) public view returns (bool) {
        return voterData[email].hasGeneratedKeys;
    }

    modifier registrationOpen() {
        if (block.timestamp >= registrationEndTime) {
            revert RegistrationPeriodEnded();
        }
        _;
    }

    modifier submissionOpen() {
        if (block.timestamp < registrationEndTime || block.timestamp >= submissionEndTime) {
            revert SubmissionPeriodNotActive();
        }
        _;
    }

    modifier votingOpen() {
        if (block.timestamp < submissionEndTime || block.timestamp >= votingEndTime) {
            revert VotingPeriodNotActive();
        }
        _;
    }

    modifier checkAdminFunds() {
        if (admin.balance < MINIMUM_BALANCE) {
            revert InsufficientFunds({
                required: MINIMUM_BALANCE,
                available: admin.balance
            });
        }
        _;
    }

    constructor(
        uint256 _registrationDuration,
        uint256 _submissionDuration,
        uint256 _votingDuration,
        string[] memory _candidates,
        string[] memory _allowedDomains
     ) {
        admin = msg.sender;
        registrationStartTime = block.timestamp;
        registrationEndTime = block.timestamp + _registrationDuration;
        submissionEndTime = registrationEndTime + _submissionDuration;
        votingEndTime = submissionEndTime + _votingDuration;
        
        for (uint i = 0; i < _candidates.length; i++) {
            candidates.push(Candidate({
                name: _candidates[i],
                voteCount: 0
            }));
            candidateIndex[_candidates[i]] = i;
        }

        allowedDomains = _allowedDomains;
    }

    function submitVotingPublicKey(
        string calldata votingPublicKey,
        string calldata ringSignature,
        bytes calldata keyImage,
        address voterAddress     
     ) external submissionOpen checkAdminFunds {
        bytes32 ringSignatureHash = keccak256(abi.encodePacked(ringSignature));
        bytes32 keyImageHash = keccak256(abi.encodePacked(keyImage));

        if (usedKeyImages[keyImageHash]) {    
            revert KeyImageAlreadyUsed();
        }

        // Push to array and store index for later lookup
        votingKeySubmissions.push(VotingKeySubmission({
            isUsed: false,
            votingPublicKey: votingPublicKey,   
            ringSignatureHash: ringSignatureHash,
            keyImageHash: keyImageHash,
            voterAddress: voterAddress
        }));

        usedKeyImages[keyImageHash] = true;
        votingKeySubmissionIndex[votingPublicKey] = votingKeySubmissions.length - 1;  

        emit VotingKeySubmitted(votingPublicKey);
    }

    function _validateEmail(string calldata email) internal view returns (bool) {
        bytes calldata emailBytes = bytes(email);
        
        for (uint i = 0; i < allowedDomains.length; i++) {
            bytes memory domain = bytes(allowedDomains[i]);
            
            if (emailBytes.length < domain.length) continue;
            
            bool matches = true;
            for (uint j = 0; j < domain.length; j++) {
                if (emailBytes[emailBytes.length - domain.length + j] != domain[j]) {
                    matches = false;
                    break;
                }
            }
            
            if (matches) return true;
        }
        
        return false;
    }

    function verifySignature(
        string calldata email,
        string calldata publicKey,
        bytes calldata signature
     ) public pure returns (bool) {
        bytes32 messageHash = keccak256(abi.encodePacked(email, publicKey));
        bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address signer = recoverSigner(prefixedHash, signature);
        return signer == ELECTION_AUTHORITY;
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes calldata _signature)
        public
        pure
        returns (address)
     {
        if (_signature.length != 65) revert InvalidSignatureLength();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(add(_signature.offset, 0))
            s := calldataload(add(_signature.offset, 32))
            v := byte(0, calldataload(add(_signature.offset, 64)))
        }

        if (v < 27) v += 27;

        address signer = ecrecover(_ethSignedMessageHash, v, r, s);
        if (signer == address(0)) revert InvalidSignature();

        return signer;
    }

    function registerVoter(
        string calldata email,
        string calldata voterPublicKey,
        bytes calldata signature
     ) external registrationOpen checkAdminFunds {
        // Validate email domain
        if (!_validateEmail(email)) {   
            revert InvalidEmailDomain();
        }

        // Check if already registered
        if (voterData[email].hasGeneratedKeys) {
            revert EmailAlreadyRegistered();
        }

        // Verify signature
        if (!verifySignature(email, voterPublicKey, signature)) {
            revert InvalidSignature();
        }

        // Gas optimization: Calculate hashes once
        bytes32 emailHash = keccak256(abi.encodePacked(email));
        bytes32 publicKeyHash = keccak256(abi.encodePacked(voterPublicKey));
        bytes32 signatureHash = keccak256(signature);

        // Store voter data
        voterData[email] = VoterData({
            hasGeneratedKeys: true,
            publicKeyHash: publicKeyHash,
            emailHash: emailHash,
            signatureHash: signatureHash
        });

        // Store public key for retrieval
        voterEAPublicKeys[email] = voterPublicKey;
        registeredEmails[emailCount] = email;
        emailCount++;

        emit KeysGenerated(email, voterPublicKey);
    }

    function castVote(
        string calldata candidateName,
        string calldata votingPublicKey,
        bytes calldata signature    
     ) external votingOpen checkAdminFunds {
        // Check if candidate exists
        if (candidateIndex[candidateName] >= candidates.length) {
            revert InvalidCandidate();
        }
        
        uint256 submissionIndex = votingKeySubmissionIndex[votingPublicKey];  
        VotingKeySubmission storage submission = votingKeySubmissions[submissionIndex];
        address storedVoterAddress = submission.voterAddress;
        
        if (submission.isUsed) {
            revert VotingKeyAlreadyUsed();
        }
        
        bytes32 messageHash = keccak256(abi.encodePacked(candidateName, votingPublicKey));
        bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address signer = recoverSigner(prefixedHash, signature);
    
        require(signer == storedVoterAddress, "Signature does not match registered voter");
        
        recoverSigner(prefixedHash, signature);
        
        submission.isUsed = true;
        
        candidates[candidateIndex[candidateName]].voteCount++;
        
        emit VoteCast(candidateName);
    }

    function getVoterPublicKey(string calldata email) external view returns (string memory) {
        if (!voterData[email].hasGeneratedKeys) {
            revert EmailNotRegistered();
        }
        return voterEAPublicKeys[email];
    }

    function getRegisteredEmails() external view returns (string[] memory) {
        string[] memory emails = new string[](emailCount);
        for(uint i = 0; i < emailCount; i++) {
            emails[i] = registeredEmails[i];
        }
        return emails;
    }

    function getVotingKeySubmissions() external view returns (
        string[] memory votingPublicKeys,
        bytes32[] memory ringSignatureHashes,
        bytes32[] memory keyImageHashes
     ) {
        uint256 length = votingKeySubmissions.length;
        votingPublicKeys = new string[](length);
        ringSignatureHashes = new bytes32[](length);
        keyImageHashes = new bytes32[](length);
        
        for (uint i = 0; i < length; i++) {
            votingPublicKeys[i] = votingKeySubmissions[i].votingPublicKey;
            ringSignatureHashes[i] = votingKeySubmissions[i].ringSignatureHash;
            keyImageHashes[i] = votingKeySubmissions[i].keyImageHash;
        }
        
        return (votingPublicKeys, ringSignatureHashes, keyImageHashes);
    }

    function isKeyImageUsed(bytes calldata keyImage) external   view returns (bool) {
        bytes32 keyImageHash = keccak256(abi.encodePacked(keyImage));
        return usedKeyImages[keyImageHash];
    }

    function getCaseId() external pure returns (string memory) {
        return CASE_ID;
    }

    function getAllEAPublicKeys() external view returns (string[] memory) {
        string[] memory keys = new string[](emailCount);
        for(uint i = 0; i < emailCount; i++) {
            string memory email = registeredEmails[i];
            keys[i] = voterEAPublicKeys[email];
        }
        return keys;
    }

    function getVoteCounts() external view returns (Candidate[] memory) {
        return candidates;
    }

    function getAdminBalance() external view returns (uint256) {
        return admin.balance;
    }
    
    function getAllowedDomains() external view returns (string[] memory) {
        return allowedDomains;
    }

    function getCandidates() public view returns (string[] memory) {
        string[] memory candidateNames = new string[](candidates.length);
        for (uint i = 0; i < candidates.length; i++) {
            candidateNames[i] = candidates[i].name;
        }
        return candidateNames;
    }

    function getElectionAuthorityPublicKey() external pure returns (string memory) {
        return ELECTION_AUTHORITY_PUBLIC_KEY;
    }

    function getVotingPubKeys() external view returns (string[] memory) {
        uint256 length = votingKeySubmissions.length;
        string[] memory votingPublicKeys = new string[](length);
      
        for (uint i = 0; i < length; i++) {
            votingPublicKeys[i] = votingKeySubmissions[i].votingPublicKey;
        }
      
        return votingPublicKeys;
    }

    function getCurrentPhase() public view returns (string memory) {
        if (block.timestamp < registrationEndTime) {
            return "Registration";
        } else if (block.timestamp < submissionEndTime) {
            return "Submission";
        } else if (block.timestamp < votingEndTime) {
            return "Voting";
        } else {
            return "Results";
        }
    }
 
    function endRegistration() external {
        require(block.timestamp >= registrationEndTime, "Registration period not ended yet");
        require(block.timestamp < submissionEndTime, "Submission period already started");
        emit RegistrationEnded();
    }

    function endSubmission() external {
        require(block.timestamp >= submissionEndTime, "Submission period not ended yet");
        require(block.timestamp < votingEndTime, "Voting period already started");
        emit SubmissionEnded();
    }

    function endVoting() external {
        require(block.timestamp >= votingEndTime, "Voting period not ended yet");
        emit VotingEnded();
        emit ResultPhaseStarted();
    }
}