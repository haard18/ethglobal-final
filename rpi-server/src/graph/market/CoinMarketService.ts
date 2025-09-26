// import { createClient, type SubstreamsClient } from '@substreams/core';
// import { type Module, type Block, type MapResponse } from '@substreams/core/proto';
// import axios from 'axios';

// const GRAPH_API_TOKEN = process.env.GRAPH_API_TOKEN;
// if (!GRAPH_API_TOKEN) {
//   throw new Error('GRAPH_API_TOKEN is not set in .env');
// }

// const SUBSTREAMS_ENDPOINT = 'https://substreams.thegraph.com';

// export interface TokenMetadata {
//   contract: string;
//   name: string;
//   symbol: string;
//   decimals: number;
//   circulating_supply: number;
//   total_supply: number;
//   holders: number;
//   network_id: string;
//   icon?: {
//     web3icon: string;
//   };
// }

// export interface OHLCVData {
//   datetime: string;
//   open: number;
//   high: number;
//   low: number;
//   close: number;
//   volume: number;
//   transactions: number;
// }

// export interface TokenHolder {
//   address: string;
//   amount: string;
//   value: number;
//   name: string;
//   symbol: string;
//   decimals: number;
//   network_id: string;
// }

// export interface CoinMarketData {
//   metadata: TokenMetadata;
//   ohlcv: OHLCVData[];
//   topHolders: TokenHolder[];
// }

// // ========== SERVICE CLASS ==========
// export class CoinMarketService {
//   private substreamsClient: SubstreamsClient;
//   private restEndpoint: string;

//   constructor() {
//     this.substreamsClient = createClient(SUBSTREAMS_ENDPOINT);
//     this.restEndpoint = 'https://token-api.thegraph.com'; // Fallback for non-stream data
//   }

//   /**
//    * Executes a Substreams request for real-time data
//    */
//   private async executeSubstreamsRequest(
//     moduleName: string,
//     params: Record<string, any> = {}
//   ): Promise<MapResponse> {
//     try {
//       const response = await this.substreamsClient.request({
//         substreamsPackage: 'https://github.com/streamingfast/substreams-eth-block-meta',
//         modules: [moduleName],
//         startBlock: params.startBlock || 0,
//         stopBlock: params.stopBlock || 'latest',
//         productionMode: true,
//       });
//       return response;
//     } catch (error) {
//       console.error('Substreams error:', error);
//       throw new Error(`Failed to execute Substreams request: ${error}`);
//     }
//   }

//   /**
//    * Executes a REST GET request (fallback for non-stream data)
//    */
//   private async executeRestRequest(path: string, params: Record<string, any> = {}): Promise<any> {
//     try {
//       const response = await axios.get(`${this.restEndpoint}${path}`, {
//         params,
//         headers: {
//           Authorization: `Bearer ${GRAPH_API_TOKEN}`,
//         },
//       });
//       return response.data;
//     } catch (error) {
//       console.error('REST API error:', error);
//       throw new Error(`Failed to execute REST request: ${error}`);
//     }
//   }

//   /**
//    * Fetches token metadata (name, symbol, supply, holders, etc.)
//    * Uses Substreams for real-time data if available, otherwise falls back to REST.
//    */
//   async getTokenMetadata(contractAddress: string, networkId: string = 'mainnet'): Promise<TokenMetadata | null> {
//     try {
//       // Try Substreams first (real-time)
//       const response = await this.executeSubstreamsRequest('map_token_metadata', {
//         contract: contractAddress,
//         network: networkId,
//       });
//       if (response && response.output) {
//         return JSON.parse(response.output.toString()) as TokenMetadata;
//       }
//     } catch (error) {
//       console.warn('Substreams failed, falling back to REST:', error);
//     }

//     // Fallback to REST API
//     const path = `/tokens/evm/${contractAddress}`;
//     const params = { network_id: networkId };
//     const response = await this.executeRestRequest(path, params);
//     return response.data?.[0] || null;
//   }

//   /**
//    * Fetches OHLCV (price) data for a token using Substreams
//    */
//   async getTokenOHLCV(
//     contractAddress: string,
//     interval: 'hourly' | '4-hours' | 'daily' | 'weekly' = 'daily',
//     startTime: number = Math.floor(Date.now() / 1000) - 86400 * 7, // Default: Last 7 days
//     endTime: number = Math.floor(Date.now() / 1000), // Default: Now
//     networkId: string = 'mainnet'
//   ): Promise<OHLCVData[]> {
//     try {
//       // Use Substreams for real-time OHLCV data
//       const response = await this.executeSubstreamsRequest('map_token_ohlcv', {
//         contract: contractAddress,
//         interval,
//         startTime,
//         endTime,
//         network: networkId,
//       });
//       if (response && response.output) {
//         return JSON.parse(response.output.toString()) as OHLCVData[];
//       }
//     } catch (error) {
//       console.warn('Substreams failed, falling back to REST:', error);
//     }

//     // Fallback to REST API
//     const path = `/ohlc/prices/evm/${contractAddress}`;
//     const params = {
//       network_id: networkId,
//       interval,
//       startTime,
//       endTime,
//       limit: 1000,
//     };
//     const response = await this.executeRestRequest(path, params);
//     return response.data || [];
//   }

//   /**
//    * Fetches top holders of a token using Substreams
//    */
//   async getTokenHolders(
//     contractAddress: string,
//     limit: number = 10,
//     networkId: string = 'mainnet'
//   ): Promise<TokenHolder[]> {
//     try {
//       // Use Substreams for real-time holder data
//       const response = await this.executeSubstreamsRequest('map_token_holders', {
//         contract: contractAddress,
//         limit,
//         network: networkId,
//       });
//       if (response && response.output) {
//         return JSON.parse(response.output.toString()) as TokenHolder[];
//       }
//     } catch (error) {
//       console.warn('Substreams failed, falling back to REST:', error);
//     }

//     // Fallback to REST API
//     const path = `/holders/evm/${contractAddress}`;
//     const params = {
//       network_id: networkId,
//       orderBy: 'value',
//       orderDirection: 'desc',
//       limit,
//     };
//     const response = await this.executeRestRequest(path, params);
//     return response.data || [];
//   }

//   /**
//    * Fetches full market data for a token (metadata + OHLCV + holders)
//    */
//   async getCoinMarketData(
//     contractAddress: string,
//     networkId: string = 'mainnet'
//   ): Promise<CoinMarketData | null> {
//     const [metadata, ohlcv, topHolders] = await Promise.all([
//       this.getTokenMetadata(contractAddress, networkId),
//       this.getTokenOHLCV(contractAddress, 'daily', undefined, undefined, networkId),
//       this.getTokenHolders(contractAddress, 10, networkId),
//     ]);

//     if (!metadata) return null;

//     return {
//       metadata,
//       ohlcv,
//       topHolders,
//     };
//   }

//   /**
//    * Monitors token price in real-time using Substreams
//    */
//   async startPriceMonitoring(
//     contractAddress: string,
//     callback: (ohlcv: OHLCVData) => void,
//     networkId: string = 'mainnet'
//   ): Promise<void> {
//     console.log(`Starting real-time price monitoring for ${contractAddress} (${networkId})`);

//     // Use Substreams for real-time updates
//     const stream = await this.substreamsClient.stream({
//       substreamsPackage: 'https://github.com/streamingfast/substreams-eth-block-meta',
//       modules: ['map_token_ohlcv'],
//       startBlock: 'latest',
//       productionMode: true,
//       params: {
//         contract: contractAddress,
//         interval: 'hourly',
//         network: networkId,
//       },
//     });

//     stream.on('data', (response: MapResponse) => {
//       if (response.output) {
//         const ohlcv = JSON.parse(response.output.toString()) as OHLCVData;
//         callback(ohlcv);
//       }
//     });

//     stream.on('error', (error: Error) => {
//       console.error('Substreams error:', error);
//     });
//   }
// }
