import { ethers } from 'ethers';

export interface PythPriceData {
    id: string;
    price: {
        price: string;
        conf: string;
        expo: number;
        publishTime: number;
    };
    emaPrice: {
        price: string;
        conf: string;
        expo: number;
        publishTime: number;
    };
}

export interface PriceUpdate {
    priceId: string;
    symbol: string;
    price: number;
    confidence: number;
    publishTime: number;
    changePercent24h?: number;
}

// Popular price feed IDs
export const PYTH_PRICE_FEEDS: Record<string, string> = {
    'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    'USDT/USD': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca5c7cb9c98a33ad8f99bfed5b9',
    'MATIC/USD': '0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52',
    'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
    'LINK/USD': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
};

export class PythNetworkOracle {
    private static readonly PYTH_ABI = [
        "function updatePriceFeeds(bytes[] calldata updateData) external payable",
        "function getPrice(bytes32 id) external view returns (int64 price, uint64 conf, int32 expo, uint publishTime)",
        "function getPriceUnsafe(bytes32 id) external view returns (int64 price, uint64 conf, int32 expo, uint publishTime)",
        "function getUpdateFee(bytes[] calldata updateData) external view returns (uint feeAmount)"
    ] as const;

    private static readonly DEFAULT_HERMES_ENDPOINT = "https://hermes.pyth.network";

    /**
     * Fetches latest price data from Hermes API
     */
    static async fetchPriceFromHermes(priceIds: string[], hermesEndpoint: string = PythNetworkOracle.DEFAULT_HERMES_ENDPOINT): Promise<PythPriceData[]> {
        try {
            const response = await fetch(
                `${hermesEndpoint}/api/latest_price_feeds?ids[]=${priceIds.join('&ids[]=')}`
            );
            
            if (!response.ok) {
                throw new Error(`Hermes API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            throw new Error(`Failed to fetch from Hermes: ${error}`);
        }
    }

    /**
     * Gets price update data for on-chain updates
     */
    static async getPriceUpdateData(priceIds: string[], hermesEndpoint: string = PythNetworkOracle.DEFAULT_HERMES_ENDPOINT): Promise<string[]> {
        try {
            const response = await fetch(
                `${hermesEndpoint}/api/latest_vaas?ids[]=${priceIds.join('&ids[]=')}`
            );
            
            if (!response.ok) {
                throw new Error(`Failed to get VAAs: ${response.statusText}`);
            }

            const data = await response.json();
            return data.map((vaa: any) => '0x' + Buffer.from(vaa, 'base64').toString('hex'));
        } catch (error) {
            throw new Error(`Failed to get price update data: ${error}`);
        }
    }

    /**
     * Updates prices on-chain using connected wallet
     */
    static async updatePricesOnChain(
        providerUrl: string,
        pythContractAddress: string,
        walletPrivateKey: string,
        priceIds: string[],
        hermesEndpoint: string = PythNetworkOracle.DEFAULT_HERMES_ENDPOINT
    ): Promise<ethers.TransactionResponse> {
        try {
            const provider = new ethers.JsonRpcProvider(providerUrl);
            const wallet = new ethers.Wallet(walletPrivateKey, provider);
            const contract = new ethers.Contract(pythContractAddress, PythNetworkOracle.PYTH_ABI, wallet);
            
            const updateData = await PythNetworkOracle.getPriceUpdateData(priceIds, hermesEndpoint);
            
            const getUpdateFee = contract.getFunction('getUpdateFee');
            const updatePriceFeeds = contract.getFunction('updatePriceFeeds');
            
            if (!getUpdateFee || !updatePriceFeeds) {
                throw new Error('Required contract methods not found');
            }
            
            // Get the required fee
            const fee = await getUpdateFee(updateData);
            
            // Update prices on-chain
            const tx = await updatePriceFeeds(updateData, {
                value: fee
            });

            return tx;
        } catch (error) {
            throw new Error(`Failed to update prices on-chain: ${error}`);
        }
    }

    /**
     * Gets current price from on-chain oracle
     */
    static async getOnChainPrice(
        providerUrl: string,
        pythContractAddress: string,
        priceId: string
    ): Promise<PriceUpdate> {
        try {
            const provider = new ethers.JsonRpcProvider(providerUrl);
            const contract = new ethers.Contract(pythContractAddress, PythNetworkOracle.PYTH_ABI, provider);
            
            const getPrice = contract.getFunction('getPrice');
            if (!getPrice) {
                throw new Error('getPrice method not found on contract');
            }
            
            const result = await getPrice(priceId);
            const price = Number(result.price) * Math.pow(10, result.expo);
            
            return {
                priceId,
                symbol: PythNetworkOracle.getPriceSymbol(priceId),
                price,
                confidence: Number(result.conf) * Math.pow(10, result.expo),
                publishTime: Number(result.publishTime)
            };
        } catch (error) {
            throw new Error(`Failed to get on-chain price: ${error}`);
        }
    }

    /**
     * Gets single asset price by symbol from Hermes
     */
    static async getPrice(assetSymbol: string, hermesEndpoint: string = PythNetworkOracle.DEFAULT_HERMES_ENDPOINT): Promise<PriceUpdate | null> {
        try {
            const priceId = PYTH_PRICE_FEEDS[assetSymbol];
            if (!priceId) {
                return null;
            }

            const priceData = await PythNetworkOracle.fetchPriceFromHermes([priceId], hermesEndpoint);
            if (!priceData || priceData.length === 0) {
                return null;
            }

            const latestPrice = priceData[0];
            if (!latestPrice?.price?.price) {
                return null;
            }

            const price = Number(latestPrice.price.price) * Math.pow(10, latestPrice.price.expo);
            
            return {
                priceId,
                symbol: assetSymbol,
                price,
                confidence: Number(latestPrice.price.conf) * Math.pow(10, latestPrice.price.expo),
                publishTime: latestPrice.price.publishTime
            };
        } catch (error) {
            throw new Error(`Failed to get price for ${assetSymbol}: ${error}`);
        }
    }

    /**
     * Gets multiple price updates for portfolio analysis
     */
    static async getMultiplePrices(assetSymbols: string[], hermesEndpoint: string = PythNetworkOracle.DEFAULT_HERMES_ENDPOINT): Promise<PriceUpdate[]> {
        try {
            const priceIds = assetSymbols
                .map(symbol => PYTH_PRICE_FEEDS[symbol])
                .filter((id): id is string => Boolean(id));
                
            if (priceIds.length === 0) {
                throw new Error('No valid price feeds found for provided assets');
            }
            
            const priceData = await PythNetworkOracle.fetchPriceFromHermes(priceIds, hermesEndpoint);
            
            return priceData.map(data => {
                if (!data?.price?.price) {
                    throw new Error(`Invalid price data structure for ${data?.id || 'unknown'}`);
                }
                
                const price = Number(data.price.price) * Math.pow(10, data.price.expo);
                return {
                    priceId: data.id,
                    symbol: PythNetworkOracle.getPriceSymbol(data.id),
                    price,
                    confidence: Number(data.price.conf) * Math.pow(10, data.price.expo),
                    publishTime: data.price.publishTime
                };
            });
        } catch (error) {
            throw new Error(`Failed to get multiple prices: ${error}`);
        }
    }

    /**
     * Calculates price difference between two assets
     */
    static async getPriceDifference(asset1: string, asset2: string, hermesEndpoint: string = PythNetworkOracle.DEFAULT_HERMES_ENDPOINT): Promise<{
        asset1Price: number;
        asset2Price: number;
        difference: number;
        percentDifference: number;
    } | null> {
        try {
            const [price1, price2] = await Promise.all([
                PythNetworkOracle.getPrice(asset1, hermesEndpoint),
                PythNetworkOracle.getPrice(asset2, hermesEndpoint)
            ]);

            if (!price1 || !price2) {
                return null;
            }

            const difference = price1.price - price2.price;
            const percentDifference = (difference / price2.price) * 100;

            return {
                asset1Price: price1.price,
                asset2Price: price2.price,
                difference,
                percentDifference
            };
        } catch (error) {
            throw new Error(`Failed to calculate price difference: ${error}`);
        }
    }

    /**
     * Validates if a price feed ID exists
     */
    static isValidPriceId(priceId: string): boolean {
        return Object.values(PYTH_PRICE_FEEDS).includes(priceId);
    }

    /**
     * Checks if asset symbol is supported
     */
    static isAssetSupported(assetSymbol: string): boolean {
        return assetSymbol in PYTH_PRICE_FEEDS;
    }

    /**
     * Gets all available asset symbols
     */
    static getAvailableAssets(): string[] {
        return Object.keys(PYTH_PRICE_FEEDS);
    }

    /**
     * Gets price feed ID for an asset symbol
     */
    static getPriceFeedId(assetSymbol: string): string | null {
        return PYTH_PRICE_FEEDS[assetSymbol] || null;
    }

    /**
     * Helper: Get symbol from price ID
     */
    private static getPriceSymbol(priceId: string): string {
        const entry = Object.entries(PYTH_PRICE_FEEDS)
            .find(([, id]) => id === priceId);
        return entry ? entry[0] : 'Unknown';
    }
}