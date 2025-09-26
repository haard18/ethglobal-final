// import axios from 'axios';

// const GRAPH_API_TOKEN = process.env.GRAPH_API_TOKEN;
// if (!GRAPH_API_TOKEN) {
//     throw new Error('GRAPH_API_TOKEN is not set in .env');
// }

// const TOKEN_API_ENDPOINT = 'https://token-api.thegraph.com';

// export interface TokenMetadata {
//     contract: string;
//     name: string;
//     symbol: string;
//     decimals: number;
//     circulating_supply: number;
//     total_supply: number;
//     holders: number;
//     network_id: string;
//     icon?: {
//         web3icon: string;
//     };
// }

// export interface OHLCVData {
//     datetime: string;
//     open: number;
//     high: number;
//     low: number;
//     close: number;
//     volume: number;
//     transactions: number;
// }

// export interface TokenHolder {
//     address: string;
//     amount: string;
//     value: number;
//     name: string;
//     symbol: string;
//     decimals: number;
//     network_id: string;
// }

// export interface CoinMarketData {
//     metadata: TokenMetadata;
//     ohlcv: OHLCVData[];
//     topHolders: TokenHolder[];
// }

// export class CoinMarketService {
//     private endpoint: string;

//     constructor() {
//         this.endpoint = TOKEN_API_ENDPOINT;
//     }

//     private async executeGetRequest(path: string, params: Record<string, any> = {}): Promise<any> {
//         try {
//             const response = await axios.get(`${this.endpoint}${path}`, {
//                 params,
//                 headers: {
//                     Authorization: `Bearer ${GRAPH_API_TOKEN}`,
//                 },
//             });
//             return response.data;
//         } catch (error) {
//             console.error('Token API error:', error);
//             throw new Error(`Failed to execute request: ${error}`);
//         }
//     }

//     async getTokenMetadata(contractAddress: string, networkId: string = 'mainnet'): Promise<TokenMetadata | null> {
//         const path = `/tokens/evm/${contractAddress}`;
//         const params = { network_id: networkId };
//         const response = await this.executeGetRequest(path, params);
//         return response.data?.[0] || null;
//     }

//     async getTokenOHLCV(
//         contractAddress: string,
//         interval: 'hourly' | '4-hours' | 'daily' | 'weekly' = 'daily',
//         startTime: number = Math.floor(Date.now() / 1000) - 86400 * 7,
//         endTime: number = Math.floor(Date.now() / 1000),
//         networkId: string = 'mainnet'
//     ): Promise<OHLCVData[]> {
//         const path = `/ohlc/prices/evm/${contractAddress}`;
//         const params = {
//             network_id: networkId,
//             interval,
//             startTime,
//             endTime,
//             limit: 1000,
//         };
//         const response = await this.executeGetRequest(path, params);
//         return response.data || [];
//     }

//     async getTokenHolders(
//         contractAddress: string,
//         limit: number = 10,
//         networkId: string = 'mainnet'
//     ): Promise<TokenHolder[]> {
//         const path = `/holders/evm/${contractAddress}`;
//         const params = {
//             network_id: networkId,
//             orderBy: 'value',
//             orderDirection: 'desc',
//             limit,
//         };
//         const response = await this.executeGetRequest(path, params);
//         return response.data || [];
//     }

//     async getCoinMarketData(
//         contractAddress: string,
//         networkId: string = 'mainnet'
//     ): Promise<CoinMarketData | null> {
//         const [metadata, ohlcv, topHolders] = await Promise.all([
//             this.getTokenMetadata(contractAddress, networkId),
//             this.getTokenOHLCV(contractAddress, 'daily', undefined, undefined, networkId),
//             this.getTokenHolders(contractAddress, 10, networkId),
//         ]);

//         if (!metadata) return null;

//         return {
//             metadata,
//             ohlcv,
//             topHolders,
//         };
//     }

//     async startPriceMonitoring(
//         contractAddress: string,
//         callback: (ohlcv: OHLCVData) => void,
//         intervalMs: number = 60000,
//         networkId: string = 'mainnet'
//     ): Promise<void> {
//         let lastOHLCV: OHLCVData | null = null;

//         const fetchLatestPrice = async () => {
//             try {
//                 const ohlcvData = await this.getTokenOHLCV(contractAddress, 'hourly', undefined, undefined, networkId);
//                 if (ohlcvData.length > 0) {
//                     const latestOHLCV = ohlcvData[0];
//                     if (latestOHLCV && (!lastOHLCV || latestOHLCV.close !== lastOHLCV.close)) {
//                         callback(latestOHLCV);
//                         lastOHLCV = latestOHLCV;
//                     }
//                 }
//             } catch (error) {
//                 console.error('Error monitoring token price:', error);
//             }
//         };

//         console.log(`Starting price monitoring for ${contractAddress} (${networkId}) every ${intervalMs}ms`);
//         setInterval(fetchLatestPrice, intervalMs);
//     }
// }
