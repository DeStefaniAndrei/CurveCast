"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"

export function WalletConnect() {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState("")

  const handleConnect = () => {
    // Simulate wallet connection
    if (!isConnected) {
      // Mock wallet address
      const mockAddress = "0x1234...5678"
      setAddress(mockAddress)
      setIsConnected(true)
    } else {
      setAddress("")
      setIsConnected(false)
    }
  }

  return (
    <Button onClick={handleConnect} variant={isConnected ? "outline" : "default"} className="flex items-center gap-2">
      <Wallet className="h-4 w-4" />
      {isConnected ? address : "Connect Wallet"}
    </Button>
  )
}
