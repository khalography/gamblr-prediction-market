import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ethers } from "ethers";
import { GAMBLR_ABI, GAMBLR_ADDRESS, USDC_ADDRESS, ERC20_ABI, ARC_TESTNET_RPC } from "./gamblr-abi";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    ethereum: any;
    ethereumReady?: boolean;
  }
}

// Utility to safely wait for wallet injection with exponential backoff
async function waitForEthereum(maxWaitMs = 3000): Promise<any> {
  const startTime = Date.now();
  let lastError: any;

  while (Date.now() - startTime < maxWaitMs) {
    if (window.ethereum) {
      console.log("Ethereum provider found");
      return window.ethereum;
    }

    // Check for wallet-specific injections
    if (window.ethereum?.request || typeof window.ethereum?.send === "function") {
      console.log("Ethereum provider detected");
      return window.ethereum;
    }

    const elapsed = Date.now() - startTime;
    const delay = Math.min(100 + elapsed / 10, 500);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error("Wallet not detected. Please ensure your Web3 wallet extension is installed and enabled.");
}

interface Web3ContextType {
  account: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  contract: ethers.Contract | null;
  usdcContract: ethers.Contract | null;
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
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [usdcContract, setUsdcContract] = useState<ethers.Contract | null>(null);
  const [internalBalance, setInternalBalance] = useState<string>("0");
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let retries = 0;
    const maxRetries = 5;
    
    const setupProvider = () => {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(provider);
        
        window.ethereum.on("accountsChanged", (accounts: string[]) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
          } else {
            setAccount(null);
            setSigner(null);
          }
        });

        window.ethereum.on("chainChanged", () => {
          window.location.reload();
        });
      } else if (retries < maxRetries) {
        retries++;
        setTimeout(setupProvider, 500);
      }
    };
    
    setupProvider();
  }, []);

  useEffect(() => {
    if (account && provider) {
      const initContracts = async () => {
        try {
          const signer = await provider.getSigner();
          setSigner(signer);
          
          const gamblr = new ethers.Contract(GAMBLR_ADDRESS, GAMBLR_ABI, signer);
          const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
          
          setContract(gamblr);
          setUsdcContract(usdc);
          
          // Check if connected account is the contract owner
          try {
            const ownerAddress = await gamblr.owner();
            setIsOwner(ownerAddress.toLowerCase() === signer.address.toLowerCase());
          } catch (e) {
            console.error("Failed to fetch owner:", e);
            setIsOwner(false);
          }
          
          // Initial fetch
          await fetchBalances(signer.address, gamblr, usdc);
        } catch (error) {
          console.error("Error initializing contracts:", error);
        }
      };
      initContracts();
    }
  }, [account, provider]);

  const fetchBalances = async (userAddress: string, gamblrFn: ethers.Contract, usdcFn: ethers.Contract) => {
    try {
      const intBal = await gamblrFn.userBalances(userAddress);
      const wallBal = await usdcFn.balanceOf(userAddress);
      
      // 6 decimals
      setInternalBalance(ethers.formatUnits(intBal, 6));
      setWalletBalance(ethers.formatUnits(wallBal, 6));
    } catch (e) {
      console.error("Failed to fetch balances", e);
    }
  };

  const refreshBalances = async () => {
    if (account && contract && usdcContract) {
      await fetchBalances(account, contract, usdcContract);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setSigner(null);
    setContract(null);
    setUsdcContract(null);
    setInternalBalance("0");
    setWalletBalance("0");
    setChainId(null);
    setIsOwner(false);
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      // Wait for wallet to be injected with timeout
      const ethereum = await waitForEthereum(3000);

      // Create provider from ethereum
      const provider = new ethers.BrowserProvider(ethereum);
      
      // Get network info
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));

      // Request accounts using ethers.js provider.send()
      // This method avoids proxy issues by not directly accessing ethereum properties
      let accounts: string[] = [];
      
      try {
        accounts = await provider.send("eth_requestAccounts", []);
      } catch (error: any) {
        console.error("Request accounts error:", error);
        
        // Check if it's a user rejection (code 4001) or other specific errors
        if (error.code === 4001 || error.message?.includes("rejected")) {
          throw new Error("You rejected the connection request.");
        }
        
        if (error.code === -32002 || error.message?.includes("pending")) {
          throw new Error("Connection request already pending. Please check your wallet.");
        }
        
        // For any other error, suggest refreshing
        if (error.message?.includes("proxy") || error.message?.includes("read-only")) {
          throw new Error("Wallet connection issue. Please refresh the page and try again.");
        }
        
        // Re-throw with original error
        throw error;
      }
      
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
      } else {
        throw new Error("No accounts available in wallet");
      }
      
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      let errorMessage = error.message || "Could not connect wallet. Please try again.";
      
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
      provider,
      signer,
      contract,
      usdcContract,
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
