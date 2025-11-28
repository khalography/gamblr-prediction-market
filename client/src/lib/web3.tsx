import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { ethers } from "ethers";
import { GAMBLR_ABI, GAMBLR_ADDRESS, USDC_ADDRESS, ERC20_ABI, ARC_TESTNET_RPC } from "./gamblr-abi";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    ethereum?: any;
    backpack?: any;
  }
}

interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any;
}

interface Web3ContextType {
  account: string | null;
  getProvider: () => ethers.BrowserProvider | null;
  getSigner: () => ethers.JsonRpcSigner | null;
  getContract: () => ethers.Contract | null;
  getUsdcContract: () => ethers.Contract | null;
  internalBalance: string;
  walletBalance: string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalances: () => Promise<void>;
  isConnecting: boolean;
  chainId: number | null;
  isOwner: boolean;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [internalBalance, setInternalBalance] = useState<string>("0");
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [, forceUpdate] = useState({});
  const { toast } = useToast();

  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  const signerRef = useRef<ethers.JsonRpcSigner | null>(null);
  const contractRef = useRef<ethers.Contract | null>(null);
  const usdcContractRef = useRef<ethers.Contract | null>(null);
  const rawProviderRef = useRef<any>(null);
  const eip6963ProvidersRef = useRef<EIP6963ProviderDetail[]>([]);

  const getProvider = useCallback(() => providerRef.current, []);
  const getSigner = useCallback(() => signerRef.current, []);
  const getContract = useCallback(() => contractRef.current, []);
  const getUsdcContract = useCallback(() => usdcContractRef.current, []);

  // Listen for EIP-6963 wallet announcements
  useEffect(() => {
    const handleAnnouncement = (event: any) => {
      const detail = event.detail as EIP6963ProviderDetail;
      if (detail && detail.provider) {
        // Check if already added
        const exists = eip6963ProvidersRef.current.some(
          p => p.info.uuid === detail.info.uuid
        );
        if (!exists) {
          eip6963ProvidersRef.current.push(detail);
          console.log("Discovered wallet:", detail.info.name);
        }
      }
    };

    window.addEventListener("eip6963:announceProvider", handleAnnouncement);
    
    // Request wallets to announce themselves
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    return () => {
      window.removeEventListener("eip6963:announceProvider", handleAnnouncement);
    };
  }, []);

  useEffect(() => {
    if (account && providerRef.current) {
      const initContracts = async () => {
        try {
          const signer = await providerRef.current!.getSigner();
          signerRef.current = signer;
          
          const gamblr = new ethers.Contract(GAMBLR_ADDRESS, GAMBLR_ABI, signer);
          const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
          
          contractRef.current = gamblr;
          usdcContractRef.current = usdc;
          
          try {
            const ownerAddress = await gamblr.owner();
            setIsOwner(ownerAddress.toLowerCase() === signer.address.toLowerCase());
          } catch (e) {
            console.error("Failed to fetch owner:", e);
            setIsOwner(false);
          }
          
          await fetchBalances(signer.address, gamblr, usdc);
          forceUpdate({});
        } catch (error) {
          console.error("Error initializing contracts:", error);
        }
      };
      initContracts();
    }
  }, [account]);

  // Setup event listeners when we have a raw provider
  useEffect(() => {
    const rawProvider = rawProviderRef.current;
    if (!rawProvider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      } else {
        disconnectWallet();
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    try {
      if (rawProvider.on) {
        rawProvider.on("accountsChanged", handleAccountsChanged);
        rawProvider.on("chainChanged", handleChainChanged);
      }
    } catch (e) {
      console.warn("Could not add event listeners:", e);
    }

    return () => {
      try {
        if (rawProvider.removeListener) {
          rawProvider.removeListener("accountsChanged", handleAccountsChanged);
          rawProvider.removeListener("chainChanged", handleChainChanged);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [account]);

  const fetchBalances = async (userAddress: string, gamblrContract: ethers.Contract, usdcContract: ethers.Contract) => {
    try {
      const internal = await gamblrContract.balances(userAddress);
      setInternalBalance(ethers.formatUnits(internal, 6));
      
      const wallet = await usdcContract.balanceOf(userAddress);
      setWalletBalance(ethers.formatUnits(wallet, 6));
    } catch (e) {
      console.error("Failed to fetch balances", e);
    }
  };

  const refreshBalances = async () => {
    if (account && contractRef.current && usdcContractRef.current) {
      await fetchBalances(account, contractRef.current, usdcContractRef.current);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    signerRef.current = null;
    contractRef.current = null;
    usdcContractRef.current = null;
    providerRef.current = null;
    rawProviderRef.current = null;
    setInternalBalance("0");
    setWalletBalance("0");
    setChainId(null);
    setIsOwner(false);
    forceUpdate({});
  };

  // Get the best available wallet provider
  const getBestProvider = (): any => {
    // 1. First try EIP-6963 discovered providers
    if (eip6963ProvidersRef.current.length > 0) {
      // Prefer Backpack if available
      const backpack = eip6963ProvidersRef.current.find(
        p => p.info.name.toLowerCase().includes("backpack") || 
             p.info.rdns?.includes("backpack")
      );
      if (backpack) {
        console.log("Using EIP-6963 Backpack provider");
        return backpack.provider;
      }
      
      // Otherwise use first available
      console.log("Using EIP-6963 provider:", eip6963ProvidersRef.current[0].info.name);
      return eip6963ProvidersRef.current[0].provider;
    }

    // 2. Try window.backpack (Backpack's specific namespace)
    if (window.backpack?.isBackpack) {
      console.log("Using window.backpack provider");
      return window.backpack;
    }

    // 3. Check if window.ethereum has a providers array (multiple wallets)
    if (window.ethereum?.providers?.length > 0) {
      // Find Backpack in the providers array
      const backpack = window.ethereum.providers.find((p: any) => p.isBackpack);
      if (backpack) {
        console.log("Using Backpack from providers array");
        return backpack;
      }
      // Fall back to first provider
      console.log("Using first provider from providers array");
      return window.ethereum.providers[0];
    }

    // 4. Fall back to window.ethereum
    if (window.ethereum) {
      console.log("Using window.ethereum directly");
      return window.ethereum;
    }

    return null;
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      // Get the best available provider
      const rawProvider = getBestProvider();
      
      if (!rawProvider) {
        toast({
          title: "Wallet not found",
          description: "Please install MetaMask, Backpack, or another Web3 wallet extension.",
          variant: "destructive"
        });
        return;
      }

      // Store raw provider reference
      rawProviderRef.current = rawProvider;

      // Create ethers provider
      const provider = new ethers.BrowserProvider(rawProvider);
      providerRef.current = provider;
      
      // Get network info
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));

      // Request accounts
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
      } else {
        throw new Error("No accounts available in wallet");
      }
      
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      let errorMessage = error.message || "Could not connect wallet. Please try again.";
      
      if (error.code === 4001 || error.message?.includes("rejected")) {
        errorMessage = "You rejected the connection request.";
      } else if (error.code === -32002 || error.message?.includes("pending")) {
        errorMessage = "Connection request already pending. Please check your wallet.";
      } else if (error.message?.includes("proxy") || error.message?.includes("read-only")) {
        errorMessage = "Wallet conflict detected. Try disabling other wallet extensions and refresh the page.";
      }
      
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Web3Context.Provider value={{
      account,
      getProvider,
      getSigner,
      getContract,
      getUsdcContract,
      internalBalance,
      walletBalance,
      connectWallet,
      disconnectWallet,
      refreshBalances,
      isConnecting,
      chainId,
      isOwner
    }}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
}
