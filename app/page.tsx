"use client"

import { useEffect, useState } from "react"
import { ethers } from "ethers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PredictionModal } from "@/components/prediction-modal"
import { WalletConnect } from "@/components/wallet-connect"
import { TrendingUp } from "lucide-react"

// --- BSC testnet config ---
const FACTORY_ADDRESS = "0x25F1471e8F729a3e8424B883b9D68b2f019D6167"
const FACTORY_ABI = [
  "function getMarkets() view returns (address[])"
]
const MARKET_ABI = [
  "function prompt() view returns (string)",
  "function closeTime() view returns (uint256)"
]
const BSC_RPC = "https://bsc-testnet.infura.io/v3/fbb4fa2b1b734058b1ef4b6a3bb2a602"

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "Expired"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default function HomePage() {
  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false)
  const [marketPrompt, setMarketPrompt] = useState<string>("")
  const [marketAddress, setMarketAddress] = useState<string>("")
  const [closeTime, setCloseTime] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [wallet, setWallet] = useState<string | null>(null)

  // --- Fetch latest market, its prompt, and closeTime on mount ---
  useEffect(() => {
    async function fetchMarket() {
      setLoading(true)
      try {
        const provider = new ethers.JsonRpcProvider(BSC_RPC)
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider)
        const markets: string[] = await factory.getMarkets()
        if (markets.length === 0) {
          setMarketPrompt("No active markets.")
          setMarketAddress("")
          setCloseTime(null)
        } else {
          const latestMarket = markets[markets.length - 1]
          setMarketAddress(latestMarket)
          const market = new ethers.Contract(latestMarket, MARKET_ABI, provider)
          const prompt = await market.prompt()
          setMarketPrompt(prompt)
          const ct = await market.closeTime()
          setCloseTime(Number(ct))
        }
      } catch (err) {
        setMarketPrompt("Error loading market.")
        setMarketAddress("")
        setCloseTime(null)
      }
      setLoading(false)
    }
    fetchMarket()
  }, [])

  // --- Timer: update every second ---
  useEffect(() => {
    if (!closeTime) return
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      setTimeLeft(formatDuration(closeTime - now))
    }, 1000)
    return () => clearInterval(interval)
  }, [closeTime])

  // --- Simple wallet connect using ethers.js ---
  async function connectWallet() {
    const eth = (window as any).ethereum;
    if (eth) {
      const provider = new ethers.BrowserProvider(eth)
      const accounts = await provider.send("eth_requestAccounts", [])
      setWallet(accounts[0])
    } else {
      alert("No wallet found. Please install MetaMask or another wallet.")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">PredictMarket</h1>
          </div>
          {/* Wallet Connect Button */}
          <Button onClick={connectWallet} variant={wallet ? "outline" : "default"} className="flex items-center gap-2">
            {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Connect Wallet"}
          </Button>
        </div>
      </header>

      {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Markets Board</h2>

          {/* Market Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-orange-500">₿</span>
              {loading ? "Loading..." : marketPrompt || "No active market"}
              </CardTitle>
            {/* Show contract address and timer */}
            {marketAddress && (
              <div className="text-xs text-gray-500 mt-2">
                <span className="font-mono">{marketAddress}</span>
                <span className="ml-4">Expires in: <span className="font-semibold">{timeLeft}</span></span>
              </div>
            )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Market Question:</p>
                <p className="text-lg">{loading ? "Loading..." : marketPrompt || "No active market"}</p>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Total Predictions: 1,247</span>
                  <span>Total Volume: $45,230</span>
                </div>

              <Button onClick={() => setIsPredictionModalOpen(true)} className="w-full" size="lg" disabled={loading || !marketPrompt}>
                  Place Prediction
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Prediction Modal */}
      <PredictionModal
        isOpen={isPredictionModalOpen}
        onClose={() => setIsPredictionModalOpen(false)}
        marketQuestion={marketPrompt}
        marketAddress={marketAddress}
      />
    </div>
  )
}
