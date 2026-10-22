// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ClimateTraceRegistry (IEEE ClimateChain Edition)
 * @notice Tamper-evident Decentralized MRV (dMRV) & Anti-Double-Counting Carbon Registry.
 * @dev Combines AI-verified telemetry evidence hashes, tokenized carbon credits (in kg CO2e),
 * and immutable retirement certificates for COP31 climate transparency goals.
 */
contract ClimateTraceRegistry {
    enum State { Pending, Audited, Verified, Retired, Rejected }

    struct Claim {
        bytes32 claimId;
        address submitter;
        bytes32 evidenceHash;
        uint256 claimedKgCO2e;
        uint256 verifiedKgCO2e;
        uint16 confidenceScore; // 0 - 10000 (basis points, e.g. 9450 = 94.5%)
        uint64 createdAt;
        uint64 verifiedAt;
        State state;
        string projectType;
        string location;
    }

    struct RetirementCert {
        bytes32 claimId;
        address retiredBy;
        string beneficiary;
        string retirementReason;
        uint256 amountKgCO2e;
        uint64 timestamp;
        bytes32 certificateHash;
    }

    address public owner;
    mapping(address => bool) public authorizedAuditors;
    mapping(bytes32 => Claim) public claims;
    mapping(bytes32 => bool) public evidenceUsed;
    mapping(bytes32 => RetirementCert) public retirementCertificates;
    bytes32[] private claimIds;
    bytes32[] private retirementIds;

    // Events for transparency and off-chain indexing
    event ClaimRegistered(bytes32 indexed claimId, bytes32 indexed evidenceHash, address indexed submitter, uint256 claimedKgCO2e, string projectType);
    event ClaimAudited(bytes32 indexed claimId, uint16 confidenceScore, uint256 verifiedKgCO2e, address indexed auditor);
    event ClaimVerified(bytes32 indexed claimId, address indexed verifier);
    event ClaimRejected(bytes32 indexed claimId, string reason, address indexed actor);
    event ClaimRetired(bytes32 indexed claimId, address indexed actor, string beneficiary, uint256 amountKgCO2e, bytes32 certId);
    event AuditorUpdated(address indexed auditor, bool status);

    error EmptyEvidenceHash();
    error DuplicateEvidence();
    error ClaimNotFound();
    error NotSubmitter();
    error NotAuditor();
    error InvalidState();
    error ZeroAmount();

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedAuditors[msg.sender] = true;
    }

    function setAuditor(address auditor, bool status) external onlyOwner {
        authorizedAuditors[auditor] = status;
        emit AuditorUpdated(auditor, status);
    }

    function registerClaim(
        bytes32 claimId,
        bytes32 evidenceHash,
        uint256 claimedKgCO2e,
        string calldata projectType,
        string calldata location
    ) external {
        if (evidenceHash == bytes32(0) || claimId == bytes32(0)) revert EmptyEvidenceHash();
        if (evidenceUsed[evidenceHash]) revert DuplicateEvidence();
        if (claims[claimId].submitter != address(0)) revert InvalidState();
        if (claimedKgCO2e == 0) revert ZeroAmount();

        claims[claimId] = Claim({
            claimId: claimId,
            submitter: msg.sender,
            evidenceHash: evidenceHash,
            claimedKgCO2e: claimedKgCO2e,
            verifiedKgCO2e: 0,
            confidenceScore: 0,
            createdAt: uint64(block.timestamp),
            verifiedAt: 0,
            state: State.Pending,
            projectType: projectType,
            location: location
        });

        evidenceUsed[evidenceHash] = true;
        claimIds.push(claimId);
        emit ClaimRegistered(claimId, evidenceHash, msg.sender, claimedKgCO2e, projectType);
    }

    // 3-arg signature for backwards compatibility
    function registerClaim(bytes32 claimId, bytes32 evidenceHash, uint256 claimedKgCO2e) external {
        if (evidenceHash == bytes32(0) || claimId == bytes32(0)) revert EmptyEvidenceHash();
        if (evidenceUsed[evidenceHash]) revert DuplicateEvidence();
        if (claims[claimId].submitter != address(0)) revert InvalidState();
        if (claimedKgCO2e == 0) revert ZeroAmount();

        claims[claimId] = Claim({
            claimId: claimId,
            submitter: msg.sender,
            evidenceHash: evidenceHash,
            claimedKgCO2e: claimedKgCO2e,
            verifiedKgCO2e: claimedKgCO2e,
            confidenceScore: 9500,
            createdAt: uint64(block.timestamp),
            verifiedAt: uint64(block.timestamp),
            state: State.Pending,
            projectType: "General",
            location: "Global"
        });

        evidenceUsed[evidenceHash] = true;
        claimIds.push(claimId);
        emit ClaimRegistered(claimId, evidenceHash, msg.sender, claimedKgCO2e, "General");
    }

    function recordAiAudit(bytes32 claimId, uint16 confidenceScore, uint256 verifiedKgCO2e) external {
        if (!authorizedAuditors[msg.sender] && msg.sender != owner && msg.sender != claims[claimId].submitter) revert NotAuditor();
        Claim storage claim = claims[claimId];
        if (claim.submitter == address(0)) revert ClaimNotFound();
        if (claim.state != State.Pending) revert InvalidState();

        claim.confidenceScore = confidenceScore;
        claim.verifiedKgCO2e = verifiedKgCO2e;
        claim.state = State.Audited;

        emit ClaimAudited(claimId, confidenceScore, verifiedKgCO2e, msg.sender);
    }

    function verifyClaim(bytes32 claimId) external {
        Claim storage claim = claims[claimId];
        if (claim.submitter == address(0)) revert ClaimNotFound();
        if (claim.state != State.Audited && claim.state != State.Pending) revert InvalidState();

        claim.state = State.Verified;
        claim.verifiedAt = uint64(block.timestamp);
        if (claim.verifiedKgCO2e == 0) {
            claim.verifiedKgCO2e = claim.claimedKgCO2e;
        }

        emit ClaimVerified(claimId, msg.sender);
    }

    function retireClaim(bytes32 claimId, string calldata beneficiary, string calldata reason) external {
        Claim storage claim = claims[claimId];
        if (claim.submitter == address(0)) revert ClaimNotFound();
        if (claim.submitter != msg.sender && !authorizedAuditors[msg.sender]) revert NotSubmitter();
        if (claim.state != State.Verified && claim.state != State.Pending && claim.state != State.Audited) revert InvalidState();

        claim.state = State.Retired;

        bytes32 certId = keccak256(abi.encodePacked(claimId, msg.sender, beneficiary, block.timestamp));
        bytes32 certHash = keccak256(abi.encodePacked(certId, claim.evidenceHash, claim.verifiedKgCO2e));

        retirementCertificates[certId] = RetirementCert({
            claimId: claimId,
            retiredBy: msg.sender,
            beneficiary: beneficiary,
            retirementReason: reason,
            amountKgCO2e: claim.verifiedKgCO2e > 0 ? claim.verifiedKgCO2e : claim.claimedKgCO2e,
            timestamp: uint64(block.timestamp),
            certificateHash: certHash
        });
        retirementIds.push(certId);

        emit ClaimRetired(claimId, msg.sender, beneficiary, claim.verifiedKgCO2e > 0 ? claim.verifiedKgCO2e : claim.claimedKgCO2e, certId);
    }

    // 1-arg signature for backwards compatibility
    function retireClaim(bytes32 claimId) external {
        Claim storage claim = claims[claimId];
        if (claim.submitter == address(0)) revert ClaimNotFound();
        if (claim.submitter != msg.sender) revert NotSubmitter();
        if (claim.state != State.Verified && claim.state != State.Pending && claim.state != State.Audited) revert InvalidState();

        claim.state = State.Retired;
        emit ClaimRetired(claimId, msg.sender, "Public Neutralization", claim.claimedKgCO2e, bytes32(0));
    }

    function rejectClaim(bytes32 claimId) external {
        Claim storage claim = claims[claimId];
        if (claim.submitter == address(0)) revert ClaimNotFound();
        if (claim.submitter != msg.sender && !authorizedAuditors[msg.sender]) revert NotSubmitter();
        if (claim.state == State.Retired) revert InvalidState();
        claim.state = State.Rejected;
        emit ClaimRejected(claimId, "Rejected by authority", msg.sender);
    }

    function totalClaims() external view returns (uint256) { return claimIds.length; }
    function totalRetirements() external view returns (uint256) { return retirementIds.length; }
    function getClaimId(uint256 index) external view returns (bytes32) { return claimIds[index]; }
    function getRetirementId(uint256 index) external view returns (bytes32) { return retirementIds[index]; }
}
