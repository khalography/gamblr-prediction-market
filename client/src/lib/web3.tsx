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
  refreshBalances: () => Promise<void>;
  isConnecting: boolean;
  chainId: number | null;
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
  const { toast } = useToast();

  useEffect(() => {
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
    }
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

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast({
        title: "Wallet not found",
        description: "Please install MetaMask to use Gamblr.",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));

      // Request accounts
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);

      // Check chain ID (ARC Testnet Chain ID might be needed here, but usually standard tools handle switch)
      // For now we just connect.
      
    } catch (error: any) {
      console.error("Connection error:", error);
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect wallet.",
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
      refreshBalances,
      isConnecting,
      chainId
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
