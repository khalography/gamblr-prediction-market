import { randomUUID } from "crypto";

const CIRCLE_API_URL = "https://api.circle.com/v1/w3s";

export interface CircleUserTokenResponse {
  userToken: string;
  encryptionKey: string;
  sandbox: boolean;
}

export interface CircleChallengeResponse {
  challengeId: string;
  sandbox: boolean;
}

export class CircleService {
  private apiKey: string | undefined;
  private appId: string | undefined;
  public isSandbox: boolean;

  constructor() {
    this.apiKey = process.env.CIRCLE_API_KEY;
    this.appId = process.env.CIRCLE_APP_ID;
    
    // If either key is missing, run in Sandbox (Mock) mode
    this.isSandbox = !this.apiKey || !this.appId;
    
    if (this.isSandbox) {
      console.log("[Circle Service] Running in Sandbox (Mock) mode. Set CIRCLE_API_KEY and CIRCLE_APP_ID in .env to connect to live Circle APIs.");
    } else {
      console.log("[Circle Service] Running in Live mode connected to Circle Web3 Services.");
    }
  }

  /**
   * Registers a new user with Circle Web3 Services
   */
  async createUser(userId: string): Promise<{ success: boolean; sandbox: boolean }> {
    if (this.isSandbox) {
      return { success: true, sandbox: true };
    }

    try {
      const response = await fetch(`${CIRCLE_API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        // If user already exists (409), count as success
        if (response.status === 409 || errorText.includes("already exists")) {
          return { success: true, sandbox: false };
        }
        throw new Error(`Circle createUser failed: ${response.status} - ${errorText}`);
      }

      return { success: true, sandbox: false };
    } catch (error) {
      console.error("Error creating Circle user:", error);
      throw error;
    }
  }

  /**
   * Generates a User Session Token and Encryption Key
   */
  async createUserToken(userId: string): Promise<CircleUserTokenResponse> {
    if (this.isSandbox) {
      return {
        userToken: `mock-user-token-${randomUUID()}`,
        encryptionKey: `mock-encryption-key-${randomUUID()}`,
        sandbox: true
      };
    }

    try {
      const response = await fetch(`${CIRCLE_API_URL}/users/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Circle createUserToken failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return {
        userToken: data.data.userToken,
        encryptionKey: data.data.encryptionKey,
        sandbox: false
      };
    } catch (error) {
      console.error("Error creating Circle user token:", error);
      throw error;
    }
  }

  /**
   * Initiates a contract execution transaction challenge
   */
  async createContractExecutionChallenge(options: {
    userId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: any[];
    feeLevel?: "LOW" | "MEDIUM" | "HIGH";
  }): Promise<CircleChallengeResponse> {
    if (this.isSandbox) {
      return {
        challengeId: `mock-challenge-${randomUUID()}`,
        sandbox: true
      };
    }

    try {
      const response = await fetch(`${CIRCLE_API_URL}/user/transactions/contractExecution`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "X-User-Token": options.userId // Note: The active user session token is passed in headers
        },
        body: JSON.stringify({
          idempotencyKey: randomUUID(),
          contractAddress: options.contractAddress,
          abiFunctionSignature: options.abiFunctionSignature,
          abiParameters: options.abiParameters,
          feeLevel: options.feeLevel || "MEDIUM"
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Circle contract execution challenge failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return {
        challengeId: data.data.challengeId,
        sandbox: false
      };
    } catch (error) {
      console.error("Error creating Circle contract challenge:", error);
      throw error;
    }
  }

  /**
   * Fetches user wallets associated with a userId
   */
  async getUserWallets(userId: string): Promise<any[]> {
    if (this.isSandbox) {
      // Return a stable mock address derived from username for sandbox testing
      const hashedName = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const hexAddress = "0x" + "8888" + hashedName.toString(16).padStart(36, '0');
      return [{ address: hexAddress }];
    }

    try {
      const response = await fetch(`${CIRCLE_API_URL}/wallets?userId=${userId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Circle getUserWallets failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.data.wallets || [];
    } catch (error) {
      console.error("Error fetching Circle user wallets:", error);
      return [];
    }
  }
}

export const circleService = new CircleService();
