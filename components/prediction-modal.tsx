"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InteractiveDistributionChart } from "@/components/interactive-distribution-chart"

interface PredictionModalProps {
  isOpen: boolean
  onClose: () => void
  marketQuestion: string
}

export function PredictionModal({ isOpen, onClose, marketQuestion }: PredictionModalProps) {
  const [mean, setMean] = useState(55000) // Default mean
  const [standardDeviation, setStandardDeviation] = useState(5000) // Default std dev
  const [stake, setStake] = useState("")

  const handleSubmit = () => {
    // Simulate submission - in real app, this would call smart contract
    const prediction = {
      mean,
      standardDeviation,
      stake: Number.parseFloat(stake) || 0,
    }

    console.log("Submitting prediction:", prediction)
    alert(
      `Prediction submitted!\nMean: $${prediction.mean.toLocaleString()}\nStd Dev: $${prediction.standardDeviation.toLocaleString()}\nStake: $${prediction.stake}`,
    )
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <Label htmlFor="stake">Stake Amount (USDT)</Label>
            <Input
              id="stake"
              type="number"
              placeholder="Enter stake amount"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="flex-1" disabled={!stake || Number.parseFloat(stake) <= 0}>
              Submit Prediction
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
