
import { createCredential } from "./createCredential";
import logger from 'pino-utils';
import { config } from "./config";
import { getClobClient } from "./clobclient";
import { waitForMinimumUsdcBalance } from "./utils/balance";
import { approveUSDCAllowance, updateClobBalanceAllowance } from "./security/allowance";
import { CopytradeArbBot } from "./copytrade";

function msUntilNext15mBoundary(now: Date = new Date()): number {
    const d = new Date(now);
    d.setSeconds(0, 0);
    const m = d.getMinutes();
    const nextMin = (Math.floor(m / 15) + 1) * 15;
    d.setMinutes(nextMin, 0, 0);
    return Math.max(0, d.getTime() - now.getTime());
}

function msUntilNextHourBoundary(now: Date = new Date()): number {
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    const h = d.getHours();
    const nextHour = (h + 1) % 24;
    d.setHours(nextHour, 0, 0, 0);
    return Math.max(0, d.getTime() - now.getTime());
}

async function waitForNextMarketStart(): Promise<void> {
    const ms = msUntilNext15mBoundary();
    if (ms <= 0) return;
    console.log(
        `Waiting for next hour market start: ${Math.ceil(ms / 1000)}s (start at next boundary)`
    );
    await new Promise((resolve) => setTimeout(resolve, ms));
    console.log("Next hour market started — starting bot now");
}

async function main() {
    logger.info("Initializing client...");
    const clobClient = await getClobClient();
    
    if (clobClient) {
        try {
            console.log("Approving USDC allowances to Polymarket contracts...");
            await approveUSDCAllowance();

            // Update CLOB API to sync with on-chain allowances
            console.log("Syncing allowances with CLOB API...");
            await updateClobBalanceAllowance(clobClient);
        } catch (error) {
            console.log("Failed to approve USDC allowances", error);
            console.log("Continuing without allowances - orders may fail");
        }

        // Validation gate: proceed only once available USDC balance is >= $1
        const { ok, available, allowance, balance } = await waitForMinimumUsdcBalance(clobClient, config.bot.minUsdcBalance, {
            pollIntervalMs: 15_000,
            timeoutMs: 0, // wait indefinitely
            logEveryPoll: true,
        });
        console.log(
            `waitForMinimumUsdcBalance ==> ok=${ok} available=${available} allowance=${allowance} balance=${balance}`
        );
        
        if (config.bot.waitForNextMarketStart) {
            await waitForNextMarketStart();
        } else {
            console.log("Skipping wait for next 15m market start (resume immediately from state)");
        }
        
        const copytrade = CopytradeArbBot.fromEnv(clobClient);
        copytrade.start();
    } else {
        console.log("Failed to initialize CLOB client - cannot continue");
        return;
    }
}

main().catch((error) => {
    console.log("Fatal error", error);
    process.exit(1);
});
