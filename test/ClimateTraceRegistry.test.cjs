const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ClimateTraceRegistry (IEEE ClimateChain Edition)", function () {
  async function deploy() {
    const Registry = await ethers.getContractFactory("ClimateTraceRegistry");
    const registry = await Registry.deploy();
    return registry;
  }

  it("registers a claim and emits an event", async function () {
    const registry = await deploy();
    const claimId = ethers.id("claim-001");
    const evidence = ethers.id("evidence-001");
    await expect(registry["registerClaim(bytes32,bytes32,uint256)"](claimId, evidence, 125000))
      .to.emit(registry, "ClaimRegistered");
    const claim = await registry.claims(claimId);
    expect(claim.claimedKgCO2e).to.equal(125000);
    expect(await registry.totalClaims()).to.equal(1);
  });

  it("rejects duplicate evidence hashes", async function () {
    const registry = await deploy();
    const evidence = ethers.id("same-evidence");
    await registry["registerClaim(bytes32,bytes32,uint256)"](ethers.id("claim-A"), evidence, 100);
    await expect(registry["registerClaim(bytes32,bytes32,uint256)"](ethers.id("claim-B"), evidence, 100))
      .to.be.revertedWithCustomError(registry, "DuplicateEvidence");
  });

  it("only allows the submitter or authorized party to retire a claim", async function () {
    const [owner, other] = await ethers.getSigners();
    const registry = await deploy();
    const claimId = ethers.id("claim-retire");
    await registry.connect(owner)["registerClaim(bytes32,bytes32,uint256)"](claimId, ethers.id("evidence-retire"), 250);
    await expect(registry.connect(other)["retireClaim(bytes32)"](claimId))
      .to.be.revertedWithCustomError(registry, "NotSubmitter");
    await registry.connect(owner)["retireClaim(bytes32)"](claimId);
    expect((await registry.claims(claimId)).state).to.equal(3); // Retired
  });

  it("supports the full dMRV lifecycle: Register -> AI Audit -> Verify -> Permanent Retirement", async function () {
    const [submitter, verifier] = await ethers.getSigners();
    const registry = await deploy();

    // Set verifier as authorized auditor
    await registry.setAuditor(verifier.address, true);

    const claimId = ethers.id("solar-microgrid-001");
    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("telemetry_payload_oct_2026_q3"));
    const claimedKg = 128400; // 128.4 tonnes

    // 1. Submit claim with metadata
    await expect(
      registry.connect(submitter)["registerClaim(bytes32,bytes32,uint256,string,string)"](
        claimId,
        evidenceHash,
        claimedKg,
        "Renewable energy",
        "Rajasthan, India"
      )
    ).to.emit(registry, "ClaimRegistered");

    let claim = await registry.claims(claimId);
    expect(claim.state).to.equal(0); // Pending

    // 2. Record AI Audit result (confidence score 94.7% = 9470, verified kg = 121700)
    await expect(
      registry.connect(verifier).recordAiAudit(claimId, 9470, 121700)
    ).to.emit(registry, "ClaimAudited").withArgs(claimId, 9470, 121700, verifier.address);

    claim = await registry.claims(claimId);
    expect(claim.state).to.equal(1); // Audited
    expect(claim.confidenceScore).to.equal(9470);
    expect(claim.verifiedKgCO2e).to.equal(121700);

    // 3. Verifier signs off
    await expect(
      registry.connect(verifier).verifyClaim(claimId)
    ).to.emit(registry, "ClaimVerified");

    claim = await registry.claims(claimId);
    expect(claim.state).to.equal(2); // Verified

    // 4. Beneficiary retires the offset for COP31 sustainability goal
    await expect(
      registry.connect(submitter)["retireClaim(bytes32,string,string)"](
        claimId,
        "EcoCorp Global Logistics",
        "Scope 2 Emissions Neutralization Q3"
      )
    ).to.emit(registry, "ClaimRetired");

    claim = await registry.claims(claimId);
    expect(claim.state).to.equal(3); // Retired
    expect(await registry.totalRetirements()).to.equal(1);

    const certId = await registry.getRetirementId(0);
    const cert = await registry.retirementCertificates(certId);
    expect(cert.beneficiary).to.equal("EcoCorp Global Logistics");
    expect(cert.amountKgCO2e).to.equal(121700);
  });
});
