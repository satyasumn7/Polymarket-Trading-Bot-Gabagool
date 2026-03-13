import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { Chain, ClobClient } from "@polymarket/clob-client";
import { type ApiKeyCreds } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { config } from "./config";

let cachedClient: ClobClient | null = null;
let cachedConfig: { chainId: number; host: string } | null = null;

export async function getClobClient(): Promise<ClobClient> {
    const chainId = (config.chainId || Chain.POLYGON) as Chain;
    const host = config.clobApiUrl;
    const privateKey = config.requirePrivateKey();
    const funder = config.requirePolyFunder();
    const signer = new Wallet(privateKey);
    
    const creds = new ClobClient(host, 137, signer).createOrDeriveApiKey();
    const clobClient = new ClobClient(host, 137, signer, await creds, 1, funder);
    
    return clobClient;
}

/**
 * Clear cached ClobClient (useful for testing or re-initialization)
 */
export function clearClobClientCache(): void {
    cachedClient = null;
    cachedConfig = null;
}