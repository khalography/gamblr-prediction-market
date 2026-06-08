import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { ethers } from "ethers";
import { GAMBLR_ABI, GAMBLR_ADDRESS, USDC_ADDRESS, ERC20_ABI, ARC_TESTNET_RPC } from "./gamblr-abi";
import { useToast } from "@/hooks/use-toast";
import { CirclePinModal } from "@/components/circle-pin-modal";
import { apiRequest } from "./queryClient";

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

export type WalletType = "metamask" | "circle" | null;

interface Web3ContextType {
  account: string | null;
  walletType: WalletType;
  circleUsername: string | null;
  getProvider: () => ethers.BrowserProvider | null;
  getSigner: () => ethers.JsonRpcSigner | null;
  getContract: () => ethers.Contract | null;
  getUsdcContract: () => ethers.Contract | null;
  internalBalance: string;
  walletBalance: string;
  connectWallet: (selectedProvider?: WalletProvider) => Promise<void>;
  connectCircleWallet: (username: string) => Promise<void>;
  connectCircleSocialWallet: (provider: "google", sandboxEmail?: string) => Promise<void>;
  disconnectWallet: () => void;
  refreshBalances: () => Promise<void>;
  isConnecting: boolean;
  chainId: number | null;
  isOwner: boolean;
  availableWallets: WalletProvider[];
  showWalletSelector: boolean;
  setShowWalletSelector: (show: boolean) => void;
  isSandbox: boolean;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [circleUsername, setCircleUsername] = useState<string | null>(null);
  
  const [internalBalance, setInternalBalance] = useState<string>("0");
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<WalletProvider[]>([]);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [isSandbox, setIsSandbox] = useState(false);
  const [, forceUpdate] = useState({});
  const { toast } = useToast();

  // Circle user session info
  const circleUserTokenRef = useRef<string | null>(null);
  const circleEncryptionKeyRef = useRef<string | null>(null);
  const circleAppIdRef = useRef<string | null>(null);

  // PIN Modal State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalTitle, setPinModalTitle] = useState("Circle Secure PIN");
  const [pinModalDescription, setPinModalDescription] = useState("");
  const pinResolveRef = useRef<((pin: string) => void) | null>(null);
  const pinRejectRef = useRef<((err: Error) => void) | null>(null);

  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  const signerRef = useRef<ethers.JsonRpcSigner | null>(null);
  const contractRef = useRef<ethers.Contract | null>(null);
  const usdcContractRef = useRef<ethers.Contract | null>(null);
  const rawProviderRef = useRef<any>(null);

  // Fallback Read-Only Provider for Circle wallets
  const readProviderRef = useRef<ethers.JsonRpcProvider | null>(null);

  // Initialize read-only provider
  useEffect(() => {
    readProviderRef.current = new ethers.JsonRpcProvider(ARC_TESTNET_RPC);
  }, []);

  const getProvider = useCallback(() => providerRef.current, []);
  const getSigner = useCallback(() => signerRef.current, []);

  // PIN modal handlers
  const promptForPin = (title: string, description: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      setPinModalTitle(title);
      setPinModalDescription(description);
      pinResolveRef.current = resolve;
      pinRejectRef.current = reject;
      setPinModalOpen(true);
    });
  };

  const handlePinSubmit = (pin: string) => {
    if (pinResolveRef.current) {
      pinResolveRef.current(pin);
    }
    setPinModalOpen(false);
  };

  const handlePinCancel = () => {
    if (pinRejectRef.current) {
      pinRejectRef.current(new Error("PIN entry cancelled."));
    }
    setPinModalOpen(false);
  };

  // Intercept write calls for Circle wallet transactions using a Proxy
  const createContractProxy = (targetContract: ethers.Contract, isUsdc = false) => {
    return new Proxy(targetContract, {
      get(target, propKey, receiver) {
        // Intercept writes if logged in with Circle
        if (walletType === "circle") {
          // Mock some read functions in Sandbox Mode to avoid reading zero values from mock addresses
          if (isSandbox) {
            if (propKey === "allowance") {
              return async () => ethers.parseUnits("999999", 6);
            }
          }

          const writeMethods = ["placeBet", "deposit", "withdraw", "claimWinnings", "approve", "createMarket", "resolveMarket"];
          if (writeMethods.includes(propKey as string)) {
            return async (...args: any[]) => {
              return executeCircleTransaction(propKey as string, args, isUsdc);
            };
          }
        }
        return Reflect.get(target, propKey, receiver);
      }
    }) as unknown as ethers.Contract;
  };

  const getContract = useCallback(() => {
    if (contractRef.current) {
      return createContractProxy(contractRef.current, false);
    }
    return null;
  }, [walletType, isSandbox]);

  const getUsdcContract = useCallback(() => {
    if (usdcContractRef.current) {
      return createContractProxy(usdcContractRef.current, true);
    }
    return null;
  }, [walletType, isSandbox]);

  // Execute a write transaction via Circle SDK or Sandbox simulation
  const executeCircleTransaction = async (methodName: string, args: any[], isUsdc = false) => {
    if (isSandbox) {
      // 1. Prompt for PIN
      toast({
        title: "Circle Security Challenge",
        description: "Please enter your PIN in the secure dialog to sign this transaction."
      });
      
      const pin = await promptForPin(
        "Confirm Sandbox Transaction",
        `Enter your PIN to authorize contract call: ${methodName}()`
      );

      // 2. Simulate transaction wait
      toast({
        title: "Signing Transaction...",
        description: "Simulating secure MPC key signature generation."
      });
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast({
        title: "Broadcasting transaction",
        description: "Waiting for block confirmation on Arc Testnet."
      });
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Simulate balance changes in local state for a realistic experience
      if (methodName === "deposit") {
        const amt = ethers.formatUnits(args[0], 6);
        setWalletBalance(prev => (Number(prev) - Number(amt)).toFixed(2));
        setInternalBalance(prev => (Number(prev) + Number(amt)).toFixed(2));
      } else if (methodName === "withdraw") {
        const amt = ethers.formatUnits(args[0], 6);
        setInternalBalance(prev => (Number(prev) - Number(amt)).toFixed(2));
        setWalletBalance(prev => (Number(prev) + Number(amt)).toFixed(2));
      } else if (methodName === "placeBet") {
        const amt = ethers.formatUnits(args[2], 6);
        setInternalBalance(prev => (Number(prev) - Number(amt)).toFixed(2));
      }

      // Return mock transaction object with wait function
      return {
        hash: "0xmocktxhash" + Math.random().toString(16).substring(2, 10),
        wait: async () => {
          return { status: 1 };
        }
      };
    } else {
      // LIVE MODE: Execute using Circle Web3 SDK
      try {
        const functionSignatures: Record<string, string> = {
          placeBet: "placeBet(uint256,bool,uint256)",
          deposit: "deposit(uint256)",
          withdraw: "withdraw(uint256)",
          claimWinnings: "claimWinnings(uint256)",
          approve: "approve(address,uint256)",
          createMarket: "createMarket(string,uint256)",
          resolveMarket: "resolveMarket(uint256,uint8)"
        };

        const signature = functionSignatures[methodName];
        if (!signature) throw new Error(`Function signature not found for: ${methodName}`);

        // Format parameters to string representation for Circle JSON API
        const formattedArgs = args.map(arg => {
          if (typeof arg === "bigint") return arg.toString();
          return arg;
        });

        // 1. Call backend to initiate challenge
        toast({ title: "Creating challenge...", description: "Requesting transaction challenge from Circle." });
        const targetAddress = isUsdc ? USDC_ADDRESS : GAMBLR_ADDRESS;
        
        const challengeRes = await apiRequest("POST", "/api/circle/challenge", {
          userToken: circleUserTokenRef.current,
          contractAddress: targetAddress,
          abiFunctionSignature: signature,
          abiParameters: formattedArgs
        });

        const challengeData = await challengeRes.json();
        const challengeId = challengeData.challengeId;

        // 2. Import SDK dynamically to ensure it runs only in browser environment
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
        const sdk = new W3SSdk({
          appSettings: { appId: circleAppIdRef.current || "" }
        });

        // 3. Execute challenge with Circle UI
        toast({ title: "Circle PIN Prompt", description: "Please enter your PIN in the secure Circle popup." });
        
        return new Promise((resolve, reject) => {
          sdk.execute(challengeId, (error, result) => {
            if (error) {
              console.error("Circle transaction error:", error);
              reject(new Error(error.message || "Circle transaction execution failed."));
            } else {
              toast({ title: "Confirmed!", description: "Circle transaction executed successfully." });
              resolve({
                hash: (result as any)?.txHash || "0x...",
                wait: async () => ({ status: 1 })
              });
            }
          });
        });

      } catch (err: any) {
        console.error("Live transaction failed:", err);
        throw err;
      }
    }
  };

  // Restore session from localStorage on load
  useEffect(() => {
    const lastWallet = localStorage.getItem("lastWallet");
    const storedUsername = localStorage.getItem("circleUsername");
    const storedSandbox = localStorage.getItem("isSandbox") === "true";
    const storedAccount = localStorage.getItem("circleAccount");

    if (lastWallet === "circle" && storedUsername && storedAccount) {
      setWalletType("circle");
      setCircleUsername(storedUsername);
      setIsSandbox(storedSandbox);
      setAccount(storedAccount);

      // In Sandbox mode, set up mock balances
      if (storedSandbox) {
        setInternalBalance("250.00");
        setWalletBalance("1000.00");
      }
    }
  }, []);

  // Listen for Circle Social Login redirect hash on page load
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initSocialSdk = async () => {
      try {
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
        
        const onLoginComplete = async (error: any, result: any) => {
          if (error) {
            console.error("Circle social login redirect error:", error);
            toast({
              title: "Social Login Failed",
              description: error.message || "Failed to complete social login redirection.",
              variant: "destructive"
            });
            return;
          }
          if (result) {
            const { userToken, encryptionKey, oAuthInfo } = result;
            const userId = oAuthInfo?.socialUserUUID || oAuthInfo?.socialUserInfo?.email || "social-user";

            toast({ title: "Connecting Wallet...", description: "Retrieving your user wallet from Circle." });

            const res = await apiRequest("POST", "/api/circle/user", { username: userId });
            const data = await res.json();

            circleUserTokenRef.current = userToken;
            circleEncryptionKeyRef.current = encryptionKey;
            circleAppIdRef.current = data.appId;

            setAccount(data.walletAddress);
            setWalletType("circle");
            setCircleUsername(userId);

            localStorage.setItem("lastWallet", "circle");
            localStorage.setItem("circleUsername", userId);
            localStorage.setItem("isSandbox", "false");
            localStorage.setItem("circleAccount", data.walletAddress);

            // Clear hash so we don't re-trigger on reload
            window.location.hash = "";

            toast({
              title: "Google Wallet Connected",
              description: "Successfully authenticated with Google!"
            });
          }
        };

        const appRes = await fetch("/api/circle/app-id");
        if (appRes.ok) {
          const { appId } = await appRes.json();
          circleAppIdRef.current = appId;
          
          if (appId && appId !== "mock-app-id") {
            new W3SSdk({
              appSettings: { appId }
            }, onLoginComplete);
          }
        }
      } catch (err) {
        console.error("Error in social SDK init:", err);
      }
    };

    if (window.location.hash && (window.location.hash.includes("id_token") || window.location.hash.includes("access_token") || window.location.hash.includes("error"))) {
      initSocialSdk();
    }
  }, []);

  // Listen for EIP-6963 wallet announcements (MetaMask etc.)
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

  // Set up contract instances when provider/signer/account changes
  useEffect(() => {
    if (account) {
      if (walletType === "metamask" && providerRef.current) {
        const initMetaMaskContracts = async () => {
          try {
            const signer = await providerRef.current!.getSigner();
            signerRef.current = signer;
            contractRef.current = new ethers.Contract(GAMBLR_ADDRESS, GAMBLR_ABI, signer);
            usdcContractRef.current = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
            
            try {
              const ownerAddress = await contractRef.current.owner();
              setIsOwner(ownerAddress.toLowerCase() === signer.address.toLowerCase());
            } catch (e) {
              setIsOwner(false);
            }
            await fetchBalances(signer.address);
            forceUpdate({});
          } catch (error) {
            console.error("MetaMask contract initialization failed:", error);
          }
        };
        initMetaMaskContracts();
      } else if (walletType === "circle" && readProviderRef.current) {
        // Under Circle wallet, use the read-only RPC provider for read operations
        contractRef.current = new ethers.Contract(GAMBLR_ADDRESS, GAMBLR_ABI, readProviderRef.current);
        usdcContractRef.current = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, readProviderRef.current);
        
        if (isSandbox) {
          setIsOwner(true);
        } else {
          try {
            contractRef.current.owner().then(ownerAddress => {
              setIsOwner(ownerAddress.toLowerCase() === account.toLowerCase());
            }).catch(() => setIsOwner(false));
          } catch (e) {}
        }

        fetchBalances(account);
        forceUpdate({});
      }
    }
  }, [account, walletType]);

  const fetchBalances = async (userAddress: string) => {
    if (isSandbox && walletType === "circle") {
      // In sandbox mode, bypass direct contract fetches to avoid returning 0 for mock address
      return;
    }

    try {
      const readProvider = readProviderRef.current;
      if (!readProvider) return;

      const gamblrContract = new ethers.Contract(GAMBLR_ADDRESS, GAMBLR_ABI, readProvider);
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, readProvider);

      const internal = await gamblrContract.userBalances(userAddress);
      setInternalBalance(ethers.formatUnits(internal, 6));
      
      const wallet = await usdcContract.balanceOf(userAddress);
      setWalletBalance(ethers.formatUnits(wallet, 6));
    } catch (e) {
      console.error("Failed to fetch balances:", e);
    }
  };

  const refreshBalances = async () => {
    if (account) {
      await fetchBalances(account);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setWalletType(null);
    setCircleUsername(null);
    setIsSandbox(false);
    
    signerRef.current = null;
    contractRef.current = null;
    usdcContractRef.current = null;
    providerRef.current = null;
    rawProviderRef.current = null;
    
    circleUserTokenRef.current = null;
    circleEncryptionKeyRef.current = null;
    circleAppIdRef.current = null;

    setInternalBalance("0");
    setWalletBalance("0");
    setChainId(null);
    setIsOwner(false);

    localStorage.removeItem("lastWallet");
    localStorage.removeItem("circleUsername");
    localStorage.removeItem("isSandbox");
    localStorage.removeItem("circleAccount");
    
    forceUpdate({});
  };

  // MetaMask/Legacy connect
  const connectWallet = async (selectedProvider?: WalletProvider) => {
    if (!selectedProvider && availableWallets.length > 1) {
      setShowWalletSelector(true);
      return;
    }
    if (!selectedProvider && availableWallets.length === 1) {
      selectedProvider = availableWallets[0];
    }
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
          description: "Please install MetaMask or another Web3 extension.",
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
      let currentChainId = Number(network.chainId);
      setChainId(currentChainId);

      const ARC_TESTNET_CHAIN_ID = 5042002;
      const ARC_TESTNET_CHAIN_ID_HEX = "0x" + ARC_TESTNET_CHAIN_ID.toString(16);

      if (currentChainId !== ARC_TESTNET_CHAIN_ID) {
        toast({
          title: "Switching Network",
          description: "Please confirm switching your wallet to Arc Testnet."
        });

        try {
          await provider.send("wallet_switchEthereumChain", [
            { chainId: ARC_TESTNET_CHAIN_ID_HEX }
          ]);
        } catch (switchError: any) {
          // 4902 is the error code for unrecognized chain
          if (switchError.code === 4902 || switchError.message?.includes("Unrecognized chain ID") || switchError.message?.includes("4902")) {
            toast({
              title: "Add Network",
              description: "Arc Testnet is not configured in your wallet. Prompting to add network..."
            });
            try {
              await provider.send("wallet_addEthereumChain", [
                {
                  chainId: ARC_TESTNET_CHAIN_ID_HEX,
                  chainName: "Arc Testnet",
                  nativeCurrency: {
                    name: "USDC",
                    symbol: "USDC",
                    decimals: 18
                  },
                  rpcUrls: ["https://rpc.testnet.arc.network"],
                  blockExplorerUrls: ["https://testnet.arcscan.app"]
                }
              ]);
            } catch (addError: any) {
              console.error("Failed to add network to wallet:", addError);
              throw new Error("Could not add Arc Testnet to your wallet extension.");
            }
          } else {
            console.error("Failed to switch network:", switchError);
            throw new Error("Please switch your wallet network to Arc Testnet manually.");
          }
        }

        // Re-fetch network details after switch
        const updatedNetwork = await provider.getNetwork();
        currentChainId = Number(updatedNetwork.chainId);
        setChainId(currentChainId);

        if (currentChainId !== ARC_TESTNET_CHAIN_ID) {
          throw new Error("Wallet must be connected to the Arc Testnet.");
        }
      }

      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts && accounts.length > 0) {
        setWalletType("metamask");
        setAccount(accounts[0]);
        localStorage.setItem("lastWallet", "metamask");
      }
    } catch (error: any) {
      console.error("MetaMask connection error:", error);
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect MetaMask wallet.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Circle user-controlled wallet connect
  const connectCircleWallet = async (username: string) => {
    setIsConnecting(true);
    try {
      // 1. Get user token and challenge setup from server
      const res = await apiRequest("POST", "/api/circle/user", { username });
      const data = await res.json();

      circleUserTokenRef.current = data.userToken;
      circleEncryptionKeyRef.current = data.encryptionKey;
      circleAppIdRef.current = data.appId;
      setIsSandbox(data.sandbox);

      if (data.sandbox) {
        // Sandbox mode connects instantly with a mock address
        const mockAddress = data.walletAddress || "0xMockCircleWalletAddress8888";
        setAccount(mockAddress);
        setWalletType("circle");
        setCircleUsername(username);
        setInternalBalance("250.00");
        setWalletBalance("1000.00");
        setIsOwner(true);

        localStorage.setItem("lastWallet", "circle");
        localStorage.setItem("circleUsername", username);
        localStorage.setItem("isSandbox", "true");
        localStorage.setItem("circleAccount", mockAddress);
        
        toast({
          title: "Circle Sandbox Login",
          description: `Logged in as ${username}. Initialized with mock balances.`
        });
      } else {
        // LIVE MODE
        if (data.walletAddress) {
          // User already has a wallet address set up
          setAccount(data.walletAddress);
          setWalletType("circle");
          setCircleUsername(username);

          localStorage.setItem("lastWallet", "circle");
          localStorage.setItem("circleUsername", username);
          localStorage.setItem("isSandbox", "false");
          localStorage.setItem("circleAccount", data.walletAddress);

          toast({
            title: "Circle Wallet Connected",
            description: `Welcome back, ${username}!`
          });
        } else {
          // New user: Needs wallet initialization (PIN setup)
          toast({
            title: "Secure PIN Setup Needed",
            description: "Initializing your new Circle wallet. Please configure a 6-digit PIN in the dialog."
          });

          // Fetch the setup challenge ID from backend (for creating user-controlled wallet)
          // Note: In typical Circle setups, when a user is new, the server generates a registration challenge
          // For our integration: We'll prompt the user for their PIN first, and use Circle's SDK to initialize.
          // Since we need a challenge ID to initialize the SDK wallet, we will call our server to get one.
          const challengeRes = await apiRequest("POST", "/api/circle/challenge", {
            userToken: data.userToken,
            // To create a wallet, Circle needs a wallet creation challenge.
            // We pass parameters to create a wallet challenge.
            contractAddress: "0x0000000000000000000000000000000000000000",
            abiFunctionSignature: "initializeWallet()",
            abiParameters: []
          });

          const challengeData = await challengeRes.json();
          const challengeId = challengeData.challengeId;

          const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
          const sdk = new W3SSdk({
            appSettings: { appId: data.appId }
          });

          return new Promise<void>((resolve, reject) => {
            sdk.execute(challengeId, async (error, result) => {
              if (error) {
                console.error("Circle PIN setup failed:", error);
                reject(new Error(error.message || "Failed to set up PIN."));
              } else {
                toast({
                  title: "PIN Configured",
                  description: "Your Circle wallet is now fully configured. Retrieving wallet address."
                });

                // Retrieve wallet address by repeating login
                const retryRes = await apiRequest("POST", "/api/circle/user", { username });
                const retryData = await retryRes.json();

                if (retryData.walletAddress) {
                  setAccount(retryData.walletAddress);
                  setWalletType("circle");
                  setCircleUsername(username);

                  localStorage.setItem("lastWallet", "circle");
                  localStorage.setItem("circleUsername", username);
                  localStorage.setItem("isSandbox", "false");
                  localStorage.setItem("circleAccount", retryData.walletAddress);
                  resolve();
                } else {
                  reject(new Error("Unable to retrieve wallet address after setup."));
                }
              }
            });
          });
        }
      }
    } catch (err: any) {
      console.error("Circle wallet login failed:", err);
      toast({
        title: "Login Failed",
        description: err.message || "Could not log in with Circle wallet.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Circle user-controlled wallet connect with Google
  const connectCircleSocialWallet = async (provider: "google", sandboxEmail?: string) => {
    setIsConnecting(true);
    try {
      if (isSandbox || !circleAppIdRef.current) {
        // Sandbox mode connects instantly with a mock Google address
        const email = sandboxEmail || "mock-google-user@gmail.com";
        const hashedName = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const mockAddress = "0x" + "9999" + hashedName.toString(16).padStart(36, '0');
        
        setAccount(mockAddress);
        setWalletType("circle");
        setCircleUsername(email);
        setInternalBalance("250.00");
        setWalletBalance("1000.00");
        setIsOwner(true);

        localStorage.setItem("lastWallet", "circle");
        localStorage.setItem("circleUsername", email);
        localStorage.setItem("isSandbox", "true");
        localStorage.setItem("circleAccount", mockAddress);
        
        toast({
          title: "Google Sandbox Login",
          description: `Logged in via Google as ${email}. Initialized with mock balances.`
        });
      } else {
        // LIVE MODE using Circle SDK
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
        const sdk = new W3SSdk({
          appSettings: { appId: circleAppIdRef.current || "" }
        });

        // Trigger Google OAuth redirect/popup flow via Circle SDK
        toast({ title: "Redirecting...", description: "Connecting to Google Auth." });
        await sdk.performLogin("Google" as any);
      }
    } catch (err: any) {
      console.error("Circle Google login failed:", err);
      toast({
        title: "Login Failed",
        description: err.message || "Could not log in with Google.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Web3Context.Provider value={{
      account,
      walletType,
      circleUsername,
      getProvider,
      getSigner,
      getContract,
      getUsdcContract,
      internalBalance,
      walletBalance,
      connectWallet,
      connectCircleWallet,
      connectCircleSocialWallet,
      disconnectWallet,
      refreshBalances,
      isConnecting,
      chainId,
      isOwner,
      availableWallets,
      showWalletSelector,
      setShowWalletSelector,
      isSandbox
    }}>
      {children}
      <CirclePinModal
        isOpen={pinModalOpen}
        onClose={handlePinCancel}
        onSubmit={handlePinSubmit}
        title={pinModalTitle}
        description={pinModalDescription}
      />
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
