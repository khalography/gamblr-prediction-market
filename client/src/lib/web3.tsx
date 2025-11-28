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

export interface WalletProvider {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
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
  connectWallet: (selectedProvider?: WalletProvider) => Promise<void>;
  disconnectWallet: () => void;
  refreshBalances: () => Promise<void>;
  isConnecting: boolean;
  chainId: number | null;
  isOwner: boolean;
  availableWallets: WalletProvider[];
  showWalletSelector: boolean;
  setShowWalletSelector: (show: boolean) => void;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [internalBalance, setInternalBalance] = useState<string>("0");
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<WalletProvider[]>([]);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [, forceUpdate] = useState({});
  const { toast } = useToast();

  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  const signerRef = useRef<ethers.JsonRpcSigner | null>(null);
  const contractRef = useRef<ethers.Contract | null>(null);
  const usdcContractRef = useRef<ethers.Contract | null>(null);
  const rawProviderRef = useRef<any>(null);

  const getProvider = useCallback(() => providerRef.current, []);
  const getSigner = useCallback(() => signerRef.current, []);
  const getContract = useCallback(() => contractRef.current, []);
  const getUsdcContract = useCallback(() => usdcContractRef.current, []);

  // Listen for EIP-6963 wallet announcements
  useEffect(() => {
    const discoveredWallets: WalletProvider[] = [];
    
    const handleAnnouncement = (event: any) => {
      const detail = event.detail;
      if (detail && detail.provider && detail.info) {
        const exists = discoveredWallets.some(p => p.uuid === detail.info.uuid);
        if (!exists) {
          const wallet: WalletProvider = {
            uuid: detail.info.uuid,
            name: detail.info.name,
            icon: detail.info.icon,
            rdns: detail.info.rdns || "",
            provider: detail.provider
          };
          discoveredWallets.push(wallet);
          setAvailableWallets([...discoveredWallets]);
        }
      }
    };

    window.addEventListener("eip6963:announceProvider", handleAnnouncement);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Also add legacy window.ethereum as fallback
    setTimeout(() => {
      if (discoveredWallets.length === 0 && window.ethereum) {
        const legacyWallet: WalletProvider = {
          uuid: "legacy-ethereum",
          name: window.ethereum.isMetaMask ? "MetaMask" : 
                window.ethereum.isBackpack ? "Backpack" : 
                window.ethereum.isCoinbaseWallet ? "Coinbase Wallet" : "Browser Wallet",
          icon: "",
          rdns: "",
          provider: window.ethereum
        };
        discoveredWallets.push(legacyWallet);
        setAvailableWallets([...discoveredWallets]);
      }
    }, 500);

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
      } catch (e) {}
    };
  }, [account]);

  const fetchBalances = async (userAddress: string, gamblrContract: ethers.Contract, usdcContract: ethers.Contract) => {
    try {
      // Contract uses "userBalances" not "balances"
      const internal = await gamblrContract.userBalances(userAddress);
      setInternalBalance(ethers.formatUnits(internal, 6));
      
      const wallet = await usdcContract.balanceOf(userAddress);
      setWalletBalance(ethers.formatUnits(wallet, 6));
    } catch (e) {
      console.error("Failed to fetch balances:", e);
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

  const connectWallet = async (selectedProvider?: WalletProvider) => {
    // If no provider selected and multiple wallets available, show selector
    if (!selectedProvider && availableWallets.length > 1) {
      setShowWalletSelector(true);
      return;
    }

    // If no provider selected but only one wallet, use it
    if (!selectedProvider && availableWallets.length === 1) {
      selectedProvider = availableWallets[0];
    }

    // If still no provider, check legacy fallbacks
    if (!selectedProvider) {
      if (window.ethereum) {
        selectedProvider = {
          uuid: "legacy",
          name: "Browser Wallet",
          icon: "",
          rdns: "",
          provider: window.ethereum
        };
      } else {
        toast({
          title: "Wallet not found",
          description: "Please install a Web3 wallet extension like MetaMask or Backpack.",
          variant: "destructive"
        });
        return;
      }
    }

    setIsConnecting(true);
    setShowWalletSelector(false);
    
    try {
      const rawProvider = selectedProvider.provider;
      rawProviderRef.current = rawProvider;

      const provider = new ethers.BrowserProvider(rawProvider);
      providerRef.current = provider;
      
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));

      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts && accounts.length > 0) {
        const userAddress = accounts[0];
        setAccount(userAddress);
        
        // Initialize contracts and fetch balances immediately
        try {
          const signer = await provider.getSigner();
          signerRef.current = signer;
          
          const gamblr = new ethers.Contract(GAMBLR_ADDRESS, GAMBLR_ABI, signer);
          const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
          
          contractRef.current = gamblr;
          usdcContractRef.current = usdc;
          
          // Check if owner
          try {
            const ownerAddress = await gamblr.owner();
            setIsOwner(ownerAddress.toLowerCase() === userAddress.toLowerCase());
          } catch (e) {
            console.error("Failed to fetch owner:", e);
          }
          
          // Fetch balances
          await fetchBalances(userAddress, gamblr, usdc);
        } catch (initError) {
          console.error("Error initializing contracts:", initError);
        }
        
        // Save last used wallet
        try {
          localStorage.setItem("lastWallet", selectedProvider.uuid);
        } catch (e) {}
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
        errorMessage = "Wallet conflict detected. Try selecting a different wallet.";
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
      isOwner,
      availableWallets,
      showWalletSelector,
      setShowWalletSelector
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
