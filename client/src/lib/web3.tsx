import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
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

  const getProvider = useCallback(() => providerRef.current, []);
  const getSigner = useCallback(() => signerRef.current, []);
  const getContract = useCallback(() => contractRef.current, []);
  const getUsdcContract = useCallback(() => usdcContractRef.current, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      } else {
        setAccount(null);
        signerRef.current = null;
        contractRef.current = null;
        usdcContractRef.current = null;
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
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
    setInternalBalance("0");
    setWalletBalance("0");
    setChainId(null);
    setIsOwner(false);
    forceUpdate({});
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast({
        title: "Wallet not found",
        description: "Please install MetaMask, Backpack, or another Web3 wallet extension.",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);
    try {
      const ethereum = window.ethereum;
      
      const provider = new ethers.BrowserProvider(ethereum);
      providerRef.current = provider;
      
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));

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
