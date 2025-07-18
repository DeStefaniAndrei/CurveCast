"use client"

import { useEffect, useState } from "react"
import { ethers } from "ethers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PredictionModal } from "@/components/prediction-modal"
import { WalletConnect } from "@/components/wallet-connect"
import { TrendingUp } from "lucide-react"

// --- BSC testnet config ---
const FACTORY_V1_ADDRESS = "0x9C7CC6FFfb6ECaf9D0029B110f0Ee69f3f36E011";
const FACTORY_V2_ADDRESS = "0xf3018cbEB09bFbB6C6A674201801364e9A4f57B3";
const FACTORY_ABI = [
  "function getMarkets() view returns (address[])"
];
const MARKET_ABI = [
  "function prompt() view returns (string)",
  "function closeTime() view returns (uint256)",
  "function VERSION() view returns (string)"
];
const BSC_RPC = "https://bsc-testnet.infura.io/v3/fbb4fa2b1b734058b1ef4b6a3bb2a602";

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "Expired";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function HomePage() {
  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Fetch all markets from both factories ---
  useEffect(() => {
    async function fetchMarkets() {
      setLoading(true);
      try {
        const provider = new ethers.providers.JsonRpcProvider(BSC_RPC);
        const factories = [
          { address: FACTORY_V1_ADDRESS, version: "V1" },
          { address: FACTORY_V2_ADDRESS, version: "V2" }
        ];
        let allMarkets: any[] = [];
        for (const factoryInfo of factories) {
          const factory = new ethers.Contract(factoryInfo.address, FACTORY_ABI, provider);
          let marketAddresses: string[] = [];
          try {
            marketAddresses = await factory.getMarkets();
          } catch {}
          for (const addr of marketAddresses) {
            try {
              const market = new ethers.Contract(addr, MARKET_ABI, provider);
              const prompt = await market.prompt();
              const closeTime = await market.closeTime();
              let version = factoryInfo.version;
              try {
                version = await market.VERSION();
              } catch {}
              allMarkets.push({
                address: addr,
                prompt,
                closeTime: Number(closeTime),
                version
              });
            } catch {}
          }
        }
        // Sort by closeTime descending (latest first)
        allMarkets.sort((a, b) => b.closeTime - a.closeTime);
        setMarkets(allMarkets);
      } catch (err) {
        setMarkets([]);
      }
      setLoading(false);
    }
    fetchMarkets();
  }, []);

  // --- Timer: update every second ---
  useEffect(() => {
    if (!markets.length) return;
    const interval = setInterval(() => {
      setMarkets((prev) => prev.map((m) => ({ ...m, timeLeft: formatDuration(m.closeTime - Math.floor(Date.now() / 1000)) })));
    }, 1000);
    return () => clearInterval(interval);
  }, [markets.length]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Prediction Markets (V1 & V2)</h1>
      {loading ? (
        <div>Loading markets...</div>
      ) : markets.length === 0 ? (
        <div>No active markets.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {markets.map((market) => (
            <Card key={market.address} className="shadow-lg">
              <CardHeader>
                <CardTitle>{market.prompt}</CardTitle>
                <div className="text-xs text-gray-500">{market.address}</div>
                <div className="text-xs font-semibold text-blue-600">Version: {market.version}</div>
              </CardHeader>
              <CardContent>
                <div className="mb-2">Expires in: {formatDuration(market.closeTime - Math.floor(Date.now() / 1000))}</div>
                <Button onClick={() => { setSelectedMarket(market); setIsPredictionModalOpen(true); }}>
                  Place Prediction
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {selectedMarket && (
        <PredictionModal
          isOpen={isPredictionModalOpen}
          onClose={() => setIsPredictionModalOpen(false)}
          marketQuestion={selectedMarket.prompt}
          marketAddress={selectedMarket.address}
        />
      )}
    </div>
  );
}
