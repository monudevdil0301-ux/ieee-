import { ethers } from 'ethers';
import { OnChainTransaction } from '../types';

export interface WalletState {
  isConnected: boolean;
  address: string;
  network: string;
  isSimulated: boolean;
  balanceETH: string;
}

const STORAGE_KEY_CLAIMS = 'vericlimate_onchain_claims';
const STORAGE_KEY_RETIREMENTS = 'vericlimate_onchain_retirements';
const STORAGE_KEY_TXS = 'vericlimate_onchain_txs';

export class Web3Service {
  private static instance: Web3Service;
  private wallet: WalletState = {
    isConnected: true,
    address: '0x8fB4...d72E',
    network: 'VeriClimate EVM Node (Local Testnet)',
    isSimulated: true,
    balanceETH: '14.85'
  };

  private evidenceRegistry: Set<string> = new Set();
  private transactions: OnChainTransaction[] = [];
  private currentBlock: number = 412850;

  private constructor() {
    this.initFromStorage();
  }

  public static getInstance(): Web3Service {
    if (!Web3Service.instance) {
      Web3Service.instance = new Web3Service();
    }
    return Web3Service.instance;
  }

  private initFromStorage() {
    try {
      const storedTxs = localStorage.getItem(STORAGE_KEY_TXS);
      if (storedTxs) {
        this.transactions = JSON.parse(storedTxs);
      } else {
        // Initial genesis transactions
        this.transactions = [
          {
            hash: '0x9a3e4f1b8c2d7e6a5f0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f',
            blockNumber: 412845,
            timestamp: '2026-10-20 11:24:10',
            from: '0x8fB4...d72E',
            to: '0x12c4...e80b (Contract)',
            action: 'ClaimRegistered',
            claimId: 'CT-2026-0042',
            status: 'Success',
            gasUsed: 84210
          },
          {
            hash: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
            blockNumber: 412847,
            timestamp: '2026-10-21 14:02:44',
            from: '0x8fB4...d72E',
            to: '0x12c4...e80b (Contract)',
            action: 'ClaimAudited',
            claimId: 'CT-2026-0042',
            status: 'Success',
            gasUsed: 52400
          }
        ];
      }
    } catch {
      // Fallback
    }
  }

  public async computeEvidenceHash(rawContent: string): Promise<string> {
    const bytes = ethers.toUtf8Bytes(rawContent);
    return ethers.keccak256(bytes);
  }

  public getWallet(): WalletState {
    return this.wallet;
  }

  public async connectMetaMask(): Promise<WalletState> {
    if (typeof window !== 'undefined' && (window as unknown as { ethereum?: unknown }).ethereum) {
      try {
        const provider = new ethers.BrowserProvider((window as unknown as { ethereum: ethers.Eip1193Provider }).ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        const network = await provider.getNetwork();
        const balance = await provider.getBalance(accounts[0]);

        this.wallet = {
          isConnected: true,
          address: accounts[0],
          network: `${network.name || 'EVM Chain'} (Chain ID: ${network.chainId})`,
          isSimulated: false,
          balanceETH: parseFloat(ethers.formatEther(balance)).toFixed(4)
        };
        return this.wallet;
      } catch (err) {
        console.warn('MetaMask connection error or cancelled; using simulated node:', err);
      }
    }
    // Fallback to simulated provider
    this.wallet = {
      isConnected: true,
      address: '0x71C8...3D22',
      network: 'VeriClimate EVM Node (In-Browser RPC)',
      isSimulated: true,
      balanceETH: '25.00'
    };
    return this.wallet;
  }

  public async registerClaimOnChain(
    claimId: string,
    evidenceHash: string,
    claimedKg: number,
    projectType: string,
    location: string
  ): Promise<{ txHash: string; blockNumber: number; success: boolean; error?: string }> {
    // Double counting check
    if (this.evidenceRegistry.has(evidenceHash)) {
      const failedTx: OnChainTransaction = {
        hash: ethers.hexlify(ethers.randomBytes(32)),
        blockNumber: ++this.currentBlock,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        from: this.wallet.address,
        to: '0x12c4...e80b (Contract)',
        action: 'EvidenceRejected',
        claimId,
        status: 'Reverted',
        gasUsed: 21450
      };
      this.transactions.unshift(failedTx);
      this.saveTxs();
      throw new Error(`Execution reverted: DuplicateEvidence() - Evidence hash ${evidenceHash.slice(0, 10)}... has already been anchored on-chain!`);
    }

    this.evidenceRegistry.add(evidenceHash);
    const txHash = ethers.hexlify(ethers.randomBytes(32));
    this.currentBlock++;

    const tx: OnChainTransaction = {
      hash: txHash,
      blockNumber: this.currentBlock,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      from: this.wallet.address,
      to: '0x12c4...e80b (ClimateTraceRegistry)',
      action: 'ClaimRegistered',
      claimId,
      status: 'Success',
      gasUsed: 98400
    };

    this.transactions.unshift(tx);
    this.saveTxs();

    return { txHash, blockNumber: this.currentBlock, success: true };
  }

  public async recordAiAuditOnChain(
    claimId: string,
    confidenceScore: number,
    verifiedKg: number
  ): Promise<{ txHash: string; blockNumber: number }> {
    const txHash = ethers.hexlify(ethers.randomBytes(32));
    this.currentBlock++;

    const tx: OnChainTransaction = {
      hash: txHash,
      blockNumber: this.currentBlock,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      from: this.wallet.address,
      to: '0x12c4...e80b (ClimateTraceRegistry)',
      action: 'ClaimAudited',
      claimId,
      status: 'Success',
      gasUsed: 46200
    };

    this.transactions.unshift(tx);
    this.saveTxs();
    return { txHash, blockNumber: this.currentBlock };
  }

  public async retireClaimOnChain(
    claimId: string,
    beneficiary: string,
    reason: string,
    amountTonnes: number
  ): Promise<{ txHash: string; blockNumber: number; certificateHash: string }> {
    const txHash = ethers.hexlify(ethers.randomBytes(32));
    const certHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${claimId}|${beneficiary}|${reason}|${amountTonnes}|${Date.now()}`)
    );
    this.currentBlock++;

    const tx: OnChainTransaction = {
      hash: txHash,
      blockNumber: this.currentBlock,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      from: this.wallet.address,
      to: '0x12c4...e80b (ClimateTraceRegistry)',
      action: 'ClaimRetired',
      claimId,
      status: 'Success',
      gasUsed: 112300
    };

    this.transactions.unshift(tx);
    this.saveTxs();
    return { txHash, blockNumber: this.currentBlock, certificateHash: certHash };
  }

  public getTransactions(): OnChainTransaction[] {
    return this.transactions;
  }

  public getBlockHeight(): number {
    return this.currentBlock;
  }

  private saveTxs() {
    try {
      localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(this.transactions.slice(0, 50)));
    } catch {
      // Ignored
    }
  }
}
