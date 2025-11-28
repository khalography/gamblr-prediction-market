import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ethers } from "ethers";
import { GAMBLR_ABI, GAMBLR_ADDRESS, USDC_ADDRESS, ERC20_ABI, ARC_TESTNET_RPC } from "./gamblr-abi";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    ethereum: any;
  }
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
    if (!window.ethereum) {
      toast({
        title: "Wallet not found",
        description: "Please install a Web3 wallet like MetaMask or Backpack to use Gamblr.",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);
    try {
      // Create provider from window.ethereum
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // Get network info
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));

      // Request accounts using the provider method
      // This is more reliable than calling window.ethereum.request directly
      let accounts: string[] = [];
      
      try {
        accounts = await provider.send("eth_requestAccounts", []);
      } catch (sendError: any) {
        console.error("eth_requestAccounts error:", sendError);
        
        // If that fails, try using listAccounts as fallback
        if (sendError.code === 4001 || sendError.message?.includes("rejected")) {
          throw new Error("You rejected the connection request.");
        }
        
        throw sendError;
      }
      
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
      } else {
        throw new Error("No accounts available in wallet");
      }
      
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      let errorMessage = error.message || "Could not connect wallet. Please try again.";
      
      // Handle specific error codes and messages
      if (error.code === 4001 || error.message?.includes("rejected")) {
        errorMessage = "You rejected the connection request.";
      } else if (error.code === -32002 || error.message?.includes("pending")) {
        errorMessage = "Connection request already pending. Check your wallet extension.";
      } else if (error.message?.includes("proxy")) {
        errorMessage = "Wallet connection issue. Try refreshing the page and reconnecting.";
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
