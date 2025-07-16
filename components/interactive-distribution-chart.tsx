"use client"

import type React from "react"
import { useRef, useState, useCallback } from "react"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts"

interface InteractiveDistributionChartProps {
  mean: number
  standardDeviation: number
  onMeanChange: (mean: number) => void
  onStandardDeviationChange: (stdDev: number) => void
}

export function InteractiveDistributionChart({
  mean,
  standardDeviation,
  onMeanChange,
  onStandardDeviationChange,
}: InteractiveDistributionChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [isDraggingMean, setIsDraggingMean] = useState(false)
  const [isDraggingCurve, setIsDraggingCurve] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [initialValues, setInitialValues] = useState({ mean: 0, stdDev: 0 })

  // Fixed chart domain to prevent dynamic resizing
  const CHART_MIN_PRICE = 30000
  const CHART_MAX_PRICE = 80000
  const CHART_PRICE_RANGE = CHART_MAX_PRICE - CHART_MIN_PRICE

  // Generate normal distribution data points with fixed range
  const generateNormalDistribution = (mean: number, stdDev: number) => {
    const data = []
    const step = CHART_PRICE_RANGE / 100 // 100 data points across the fixed range

    for (let price = CHART_MIN_PRICE; price <= CHART_MAX_PRICE; price += step) {
      const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((price - mean) / stdDev, 2))
      data.push({
        price: Math.round(price),
        probability: y,
      })
    }

    return data
  }

  const data = generateNormalDistribution(mean, standardDeviation)

  // Check if click is near the mean line (within 5% of chart width)
  const isClickNearMeanLine = (clientX: number) => {
    if (!chartRef.current) return false

    const rect = chartRef.current.getBoundingClientRect()
    const chartWidth = rect.width
    const clickRatio = (clientX - rect.left) / chartWidth
    const meanRatio = (mean - CHART_MIN_PRICE) / CHART_PRICE_RANGE

    return Math.abs(clickRatio - meanRatio) < 0.05 // Within 5% of chart width
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const isNearMean = isClickNearMeanLine(e.clientX)

      if (isNearMean) {
        setIsDraggingMean(true)
        setDragStart({ x: e.clientX, y: e.clientY })
        setInitialValues({ mean, stdDev: standardDeviation })
      } else {
        setIsDraggingCurve(true)
        setDragStart({ x: e.clientX, y: e.clientY })
        setInitialValues({ mean, stdDev: standardDeviation })
      }
    },
    [mean, standardDeviation],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!chartRef.current) return

      if (isDraggingMean) {
        const deltaX = e.clientX - dragStart.x
        const rect = chartRef.current.getBoundingClientRect()
        const chartWidth = rect.width

        // Convert pixel movement to price change
        const priceChange = (deltaX / chartWidth) * CHART_PRICE_RANGE
        const newMean = Math.max(
          CHART_MIN_PRICE + 2000,
          Math.min(CHART_MAX_PRICE - 2000, initialValues.mean + priceChange),
        )

        onMeanChange(Math.round(newMean))
      } else if (isDraggingCurve) {
        const deltaY = e.clientY - dragStart.y

        // Adjust standard deviation based on vertical movement
        const stdDevSensitivity = 30
        const newStdDev = Math.max(500, Math.min(8000, initialValues.stdDev - deltaY * stdDevSensitivity))

        onStandardDeviationChange(Math.round(newStdDev))
      }
    },
    [isDraggingMean, isDraggingCurve, dragStart, initialValues, onMeanChange, onStandardDeviationChange],
  )

  const handleMouseUp = useCallback(() => {
    setIsDraggingMean(false)
    setIsDraggingCurve(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDraggingMean(false)
    setIsDraggingCurve(false)
  }, [])

  // Determine cursor style based on hover position
  const getCursorStyle = (e: React.MouseEvent) => {
    if (isDraggingMean) return "cursor-grabbing"
    if (isDraggingCurve) return "cursor-ns-resize"
    if (isClickNearMeanLine(e.clientX)) return "cursor-grab"
    return "cursor-ns-resize"
  }

  const [cursorStyle, setCursorStyle] = useState("cursor-grab")

  const handleMouseMoveHover = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingMean && !isDraggingCurve) {
        setCursorStyle(isClickNearMeanLine(e.clientX) ? "cursor-grab" : "cursor-ns-resize")
      }
      handleMouseMove(e)
    },
    [handleMouseMove, isDraggingMean, isDraggingCurve],
  )

  return (
    <div className="relative">
      <div
        ref={chartRef}
        className={`h-64 w-full select-none ${cursorStyle}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveHover}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="price"
              type="number"
              scale="linear"
              domain={[CHART_MIN_PRICE, CHART_MAX_PRICE]}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <YAxis domain={[0, "dataMax"]} hide />

            {/* Thicker draggable mean line */}
            <ReferenceLine x={mean} stroke="#ef4444" strokeWidth={4} strokeOpacity={isDraggingMean ? 0.8 : 0.6} />

            {/* Main distribution curve */}
            <Line
              type="monotone"
              dataKey="probability"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              strokeOpacity={isDraggingCurve ? 0.7 : 1}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Interaction Hints */}
      <div className="space-y-1 text-xs text-gray-500 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-red-400 rounded"></div>
          <span>Drag the red line to adjust predicted price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-blue-400 rounded"></div>
          <span>Drag the blue curve up/down to adjust confidence width</span>
        </div>
      </div>

      <div className="text-center text-sm text-gray-600 mt-2">
        Your prediction centers around <span className="font-semibold">${mean.toLocaleString()}</span> with ±$
        {standardDeviation.toLocaleString()} confidence range
        {(isDraggingMean || isDraggingCurve) && (
          <span className="text-blue-600 ml-2">
            ({isDraggingMean ? "adjusting price..." : "adjusting confidence..."})
          </span>
        )}
      </div>
    </div>
  )
}
