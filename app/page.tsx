"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PredictionModal } from "@/components/prediction-modal"
import { WalletConnect } from "@/components/wallet-connect"
import { TrendingUp } from "lucide-react"

export default function HomePage() {
  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false)

  // Mock market data
  const marketQuestion = "Predict the BTC/USDT price at January 31, 2025 12:00 UTC"
  const currentPrice = "$94,250"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">PredictMarket</h1>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Markets Board</h2>

          {/* Market Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-orange-500">₿</span>
                BTC/USDT Price Prediction
              </CardTitle>
              <CardDescription>
                Current Price: <span className="font-semibold text-green-600">{currentPrice}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Market Question:</p>
                  <p className="text-lg">{marketQuestion}</p>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Total Predictions: 1,247</span>
                  <span>Total Volume: $45,230</span>
                </div>

                <Button onClick={() => setIsPredictionModalOpen(true)} className="w-full" size="lg">
                  Place Prediction
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Prediction Modal */}
      <PredictionModal
        isOpen={isPredictionModalOpen}
        onClose={() => setIsPredictionModalOpen(false)}
        marketQuestion={marketQuestion}
      />
    </div>
  )
}
