"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InteractiveDistributionChart } from "@/components/interactive-distribution-chart"
import { ethers } from "ethers"

interface PredictionModalProps {
  isOpen: boolean
  onClose: () => void
  marketQuestion: string
  marketAddress?: string // new prop for contract address
}

const MARKET_ABI = [
  "function submitPrediction(uint256 mean, uint256 stddev) payable"
]

export function PredictionModal({ isOpen, onClose, marketQuestion, marketAddress }: PredictionModalProps) {
  const [mean, setMean] = useState(55000) // Default mean
  const [standardDeviation, setStandardDeviation] = useState(5000) // Default std dev
  const [stake, setStake] = useState("")
  const [txStatus, setTxStatus] = useState<null | "pending" | "success" | "error">(null)
  const [txError, setTxError] = useState<string>("")

  const handleSubmit = async () => {
    setTxStatus("pending")
    setTxError("")
    try {
      if (!(window as any).ethereum) throw new Error("No wallet found")
      if (!marketAddress) throw new Error("No market address")
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(marketAddress, MARKET_ABI, signer)
      const tx = await contract.submitPrediction(
        mean,
        standardDeviation,
        { value: ethers.parseEther(stake || "0") }
      )
      await tx.wait()
      setTxStatus("success")
      setTimeout(() => {
        setTxStatus(null)
        onClose()
      }, 1200)
    } catch (err: any) {
      setTxStatus("error")
      setTxError(err?.message || "Transaction failed")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Place Your Prediction</DialogTitle>
          <DialogDescription>{marketQuestion}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Values Display */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-sm text-gray-600">Predicted Price (Mean)</Label>
              <p className="text-lg font-semibold">${mean.toLocaleString()}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-600">Confidence Width (Std Dev)</Label>
              <p className="text-lg font-semibold">${standardDeviation.toLocaleString()}</p>
            </div>
          </div>

          {/* Interactive Chart */}
          <div className="space-y-2">
            <Label>Interactive Prediction Chart</Label>
            <p className="text-sm text-gray-600 mb-2">
              Click and drag horizontally to adjust your predicted price • Drag vertically to adjust confidence width
            </p>
            <div className="border rounded-lg p-4 bg-white">
              <InteractiveDistributionChart
                mean={mean}
                standardDeviation={standardDeviation}
                onMeanChange={setMean}
                onStandardDeviationChange={setStandardDeviation}
              />
            </div>
          </div>

          {/* Stake Input */}
          <div className="space-y-2">
            <Label htmlFor="stake">Stake Amount (BNB)</Label>
            <Input
              id="stake"
              type="number"
              placeholder="Enter stake amount"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              min="0"
              step="0.0001"
            />
          </div>

          {/* Transaction Status */}
          {txStatus === "pending" && <div className="text-blue-600">Transaction pending...</div>}
          {txStatus === "success" && <div className="text-green-600">Prediction submitted!</div>}
          {txStatus === "error" && <div className="text-red-600">{txError}</div>}

          {/* Submit Button */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1"
              disabled={!stake || Number.parseFloat(stake) <= 0 || txStatus === "pending"}
            >
              Submit Prediction
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
