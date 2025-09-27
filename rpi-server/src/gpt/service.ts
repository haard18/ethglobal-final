import OpenAI from 'openai';
import { gptConfig, validateConfig } from './config.js';

export interface ActionableResponse {
  isAction: boolean;
  action?: 'CREATE_WALLET' | 'IMPORT_WALLET_PRIVATE_KEY' | 'IMPORT_WALLET_MNEMONIC' | 'GET_WALLET_INFO' | 'MONITOR_WALLET' | 'GET_WALLET_TRANSACTIONS' | 'TRANSFER_ETH' | 'GET_WALLET_BALANCE' | 'GET_TOKEN_PRICE' | 'GET_PORTFOLIO_VALUE' | 'GET_TOKEN_HOLDINGS' | 'GET_WALLET_SUMMARY';
  parameters?: any;
  textResponse?: string;
}

export class GPTService {
  private openai: OpenAI;

  constructor() {
    // Validate configuration before initializing
    validateConfig();
    
    this.openai = new OpenAI({
      apiKey: gptConfig.apiKey,
    });
  }

  /**
   * Analyze user input to determine if they want to perform a wallet action
   * @param userText - The text message from the user
   * @returns ActionableResponse indicating if an action should be taken
   */
  async analyzeUserIntent(userText: string): Promise<ActionableResponse> {
    try {
      const response = await this.openai.chat.completions.create({
        model: gptConfig.model,
        messages: [
          {
            role: 'system',
            content: `You are an intelligent function dispatcher for a blockchain wallet system. Analyze the user's message and determine if they want to perform a specific wallet action.

Available functions:
- CREATE_WALLET: Generate a new Ethereum wallet (will check storage first)
- IMPORT_WALLET_PRIVATE_KEY: Import wallet using private key 
- IMPORT_WALLET_MNEMONIC: Import wallet using mnemonic phrase
- GET_WALLET_INFO: Get basic wallet information (addresses, wallet count)
- GET_WALLET_BALANCE: Get wallet ETH balance and total portfolio value
- GET_TOKEN_PRICE: Get price/value of specific tokens in wallet (requires token symbol)
- GET_PORTFOLIO_VALUE: Get complete portfolio breakdown and market values
- GET_TOKEN_HOLDINGS: Get all token holdings with current values
- GET_WALLET_SUMMARY: Get comprehensive wallet summary with balances and top holdings
- MONITOR_WALLET: Start monitoring a wallet for transactions
- GET_WALLET_TRANSACTIONS: Retrieve wallet transaction history
- TRANSFER_ETH: Transfer ETH to address or ENS name (requires amount and recipient)
- NONE: No specific wallet action requested

IMPORTANT CONTEXT:
- User wallets are saved to persistent storage at ./wallet-storage/user-wallet.json
- Always check if wallet exists before creating new ones
- For transfers, extract amount (in ETH) and recipient (address or ENS name) from user text
- For token queries, extract token symbol from user text (e.g., "ETH", "USDC", "BTC", "WETH")
- Extract parameters like: tokenSymbol, minValue, searchTerm from user queries
- Price/balance queries: "token price", "portfolio value", "wallet balance", "how much", "worth"
- Market queries: "portfolio", "holdings", "tokens", "coins", "value", "price", "balance"
- Token-specific queries: "USDC price", "ETH balance", "how much BTC", "WETH value"
- Portfolio queries: "total value", "portfolio worth", "diversification", "top holdings"

PARAMETER EXTRACTION RULES:
- Extract tokenSymbol from phrases like: "USDC price", "how much ETH", "BTC value", "my WETH"
- Extract minValue from phrases like: "tokens worth over $100", "holdings above 50 dollars"
- Extract searchTerm for general searches like: "stable coins", "tokens containing USD"

Respond ONLY with a JSON object in this exact format:
{
  "action": "ACTION_NAME",
  "confidence": 0.95,
  "parameters": {}
}

If the user wants general conversation or blockchain information (not a specific wallet action), use "NONE".
If they mention private keys or seed phrases, use the appropriate IMPORT action.
Be very confident in your classification - only use "NONE" if you're sure they don't want a wallet action.`
          },
          {
            role: 'user',
            content: userText
          }
        ],
        max_tokens: 150,
        temperature: 0.1,
      });

      const assistantMessage = response.choices[0]?.message?.content;
      
      if (!assistantMessage) {
        throw new Error('No response received from OpenAI for intent analysis');
      }

      // Parse the JSON response
      const intentData = JSON.parse(assistantMessage.trim());
      
      if (intentData.action === 'NONE' || intentData.confidence < 0.7) {
        return {
          isAction: false,
          textResponse: await this.getResponse(userText)
        };
      }

      // Generate specific response based on action type
      let actionResponse = "";
      switch (intentData.action) {
        case 'GET_WALLET_INFO':
          actionResponse = "GM, crypto explorer! Let me fetch your wallet information for you.";
          break;
        case 'GET_WALLET_BALANCE':
          actionResponse = "GM, portfolio tracker! Let me check your wallet balances and values.";
          break;
        case 'GET_TOKEN_PRICE':
          actionResponse = "GM, market analyst! Let me get that token price data for you.";
          break;
        case 'GET_PORTFOLIO_VALUE':
          actionResponse = "GM, DeFi investor! Analyzing your complete portfolio breakdown now.";
          break;
        case 'GET_TOKEN_HOLDINGS':
          actionResponse = "GM, token holder! Let me show you all your current token positions.";
          break;
        case 'GET_WALLET_SUMMARY':
          actionResponse = "GM, crypto trader! Preparing your comprehensive wallet summary.";
          break;
        case 'CREATE_WALLET':
          actionResponse = "GM, fellow validator! Ready to mint a new wallet for you!";
          break;
        case 'TRANSFER_ETH':
          actionResponse = "GM, DeFi pioneer! Let me process that transfer for you.";
          break;
        default:
          actionResponse = `GM, crypto pioneer! I understand you want to ${intentData.action.toLowerCase().replace(/_/g, ' ')}. Let me handle that for you!`;
      }

      return {
        isAction: true,
        action: intentData.action,
        parameters: intentData.parameters || {},
        textResponse: actionResponse
      };

    } catch (error) {
      console.error('Error analyzing user intent:', error);
      // Fallback to normal GPT response if intent analysis fails
      return {
        isAction: false,
        textResponse: await this.getResponse(userText)
      };
    }
  }

  /**
   * Send a text message to GPT and get Pluto's response
   * @param userText - The text message from the user
   * @returns Promise with GPT's response
   */
  async getResponse(userText: string) {
    try {
      const response = await this.openai.chat.completions.create({
        model: gptConfig.model,
        messages: [
          {
            role: 'system',
            content: gptConfig.systemPrompt
          },
          {
            role: 'user',
            content: userText
          }
        ],
        max_tokens: gptConfig.maxTokens,
        temperature: gptConfig.temperature,
        top_p: gptConfig.topP,
        frequency_penalty: gptConfig.frequencyPenalty,
        presence_penalty: gptConfig.presencePenalty,
      });

      const assistantMessage = response.choices[0]?.message?.content;
      
      if (!assistantMessage) {
        throw new Error('No response received from OpenAI');
      }
      console.log(assistantMessage);
      return assistantMessage;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      
      if (error instanceof Error) {
        throw new Error(`GPT Service Error: ${error.message}`);
      }
      
      throw new Error('Unknown error occurred while calling GPT service');
    }
  }

  /**
   * Get streaming response from GPT (for future enhancement)
   * @param userText - The text message from the user
   * @returns AsyncGenerator for streaming responses
   */
  async *getStreamingResponse(userText: string): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.openai.chat.completions.create({
        model: gptConfig.model,
        messages: [
          {
            role: 'system',
            content: gptConfig.systemPrompt
          },
          {
            role: 'user',
            content: userText
          }
        ],
        max_tokens: gptConfig.maxTokens,
        temperature: gptConfig.temperature,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('Error in streaming GPT response:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const gptService = new GPTService();