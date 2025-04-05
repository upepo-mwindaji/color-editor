"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Upload, Pipette, Download, RefreshCw, Undo, History, X, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Define the type for an edit operation
interface EditOperation {
  id: string
  originalColor: string
  replacementColor: string
  timestamp: Date
  imageUrl: string
  tolerance: number
}

// --- Helper Functions ---

// Convert hex color string to RGB object
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  // Ensure the hex color has a # prefix
  const normalizedHex = hex.startsWith('#') ? hex : `#${hex}`
  
  // Handle both 3-digit and 6-digit hex formats
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
  const formattedHex = normalizedHex.replace(shorthandRegex, (m, r, g, b) => {
    return r + r + g + g + b + b
  })

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(formattedHex)
  
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

// Convert RGB color value to HSL. Conversion formula
// adapted from https://en.wikipedia.org/wiki/HSL_and_HSV.
// Assumes r, g, and b are contained in the set [0, 255] and
// returns h, s, and l in the set [0, 1].
const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  let l = (max + min) / 2

  if (max === min) {
    h = s = 0 // achromatic
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h /= 6
  }

  return { h, s, l }
}

// Convert HSL color value to RGB. Conversion formula
// adapted from https://en.wikipedia.org/wiki/HSL_and_HSV.
// Assumes h, s, and l are contained in the set [0, 1] and
// returns r, g, and b in the set [0, 255].
const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

// --- Component ---

export function ImageColorEditor() {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [replacementColor, setReplacementColor] = useState<string>("#ff0000")
  const [isPickingColor, setIsPickingColor] = useState(false)
  const [tolerance, setTolerance] = useState([30])
  const [isProcessing, setIsProcessing] = useState(false)
  const [editHistory, setEditHistory] = useState<EditOperation[]>([])
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1)
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        setOriginalImage(img)

        // Create initial image URL
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0)
        const initialImageUrl = canvas.toDataURL("image/png")

        setCurrentImageUrl(initialImageUrl)
        setSelectedColor(null)
        setEditHistory([])
        setCurrentHistoryIndex(-1)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Handle color picking from the image
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickingColor || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const pixel = ctx.getImageData(x, y, 1, 1).data
    const color = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`

    setSelectedColor(color)
    setIsPickingColor(false)
  }

  // Process the image to replace colors
  const processImage = () => {
    if (!originalImage || !selectedColor || !canvasRef.current || !currentImageUrl) return

    setIsProcessing(true)

    // Use setTimeout to allow the UI to update before heavy processing
    setTimeout(() => {
      // Create a new image from the current state
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const canvas = canvasRef.current!
        const ctx = canvas.getContext("2d")!

        // Set canvas dimensions to match image
        canvas.width = img.width
        canvas.height = img.height

        // Draw current image state
        ctx.drawImage(img, 0, 0)

        // Log the colors for debugging
        console.log("Selected color:", selectedColor)
        console.log("Replacement color:", replacementColor)

        // Get RGB colors from hex
        let selectedRgb = hexToRgb(selectedColor)
        let replacementRgb = hexToRgb(replacementColor)

        console.log("Selected RGB:", selectedRgb)
        console.log("Replacement RGB:", replacementRgb)

        if (!selectedRgb || !replacementRgb) {
          console.error("Invalid hex color selected or replacement")
          
          // Fallback: Try to extract RGB values directly if hexToRgb fails
          // This is a last resort if the hex color format is invalid
          let fallbackSelectedRgb = null
          let fallbackReplacementRgb = null
          
          try {
            // Try to parse the selected color as RGB
            if (!selectedRgb && selectedColor) {
              const r = parseInt(selectedColor.substring(1, 3), 16)
              const g = parseInt(selectedColor.substring(3, 5), 16)
              const b = parseInt(selectedColor.substring(5, 7), 16)
              if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                fallbackSelectedRgb = { r, g, b }
                console.log("Using fallback selected RGB:", fallbackSelectedRgb)
              }
            }
            
            // Try to parse the replacement color as RGB
            if (!replacementRgb && replacementColor) {
              const r = parseInt(replacementColor.substring(1, 3), 16)
              const g = parseInt(replacementColor.substring(3, 5), 16)
              const b = parseInt(replacementColor.substring(5, 7), 16)
              if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                fallbackReplacementRgb = { r, g, b }
                console.log("Using fallback replacement RGB:", fallbackReplacementRgb)
              }
            }
            
            // If we now have both RGB values, continue processing
            if (fallbackSelectedRgb && fallbackReplacementRgb) {
              console.log("Using fallback RGB values")
            } else {
              setIsProcessing(false)
              return
            }
          } catch (e) {
            console.error("Fallback RGB extraction failed:", e)
            setIsProcessing(false)
            return
          }
          
          // Use the fallback values if original extraction failed
          if (!selectedRgb) selectedRgb = fallbackSelectedRgb
          if (!replacementRgb) replacementRgb = fallbackReplacementRgb
        }

        // Convert base colors to HSL
        const selectedHsl = rgbToHsl(selectedRgb.r, selectedRgb.g, selectedRgb.b)
        const replacementHsl = rgbToHsl(replacementRgb.r, replacementRgb.g, replacementRgb.b)

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const colorTolerance = tolerance[0]

        // Replace colors
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          // Calculate color distance (simple Euclidean distance in RGB)
          const distance = Math.sqrt(
            Math.pow(r - selectedRgb.r, 2) + Math.pow(g - selectedRgb.g, 2) + Math.pow(b - selectedRgb.b, 2),
          )

          // Replace color if within tolerance
          if (distance <= colorTolerance) {
            // Convert current pixel's color to HSL
            const currentHsl = rgbToHsl(r, g, b)

            // Calculate lightness difference
            const lightnessDiff = currentHsl.l - selectedHsl.l

            // Calculate new lightness, clamped between 0 and 1
            const newLightness = Math.max(0, Math.min(1, replacementHsl.l + lightnessDiff))

            // Create new HSL color (using replacement Hue & Saturation, new Lightness)
            const newPixelHsl = { h: replacementHsl.h, s: replacementHsl.s, l: newLightness }

            // Convert back to RGB
            const newPixelRgb = hslToRgb(newPixelHsl.h, newPixelHsl.s, newPixelHsl.l)

            // Update pixel data
            data[i] = newPixelRgb.r
            data[i + 1] = newPixelRgb.g
            data[i + 2] = newPixelRgb.b
            // Alpha (data[i + 3]) remains unchanged
          }
        }

        // Put the modified image data back
        ctx.putImageData(imageData, 0, 0)

        // Convert canvas to data URL
        const modifiedUrl = canvas.toDataURL("image/png")

        // Create new edit operation
        const newEdit: EditOperation = {
          id: Date.now().toString(),
          originalColor: selectedColor,
          replacementColor: replacementColor,
          timestamp: new Date(),
          imageUrl: modifiedUrl,
          tolerance: tolerance[0],
        }

        // If we're not at the end of history, truncate the future edits
        const newHistory = editHistory.slice(0, currentHistoryIndex + 1)

        // Update history and current state
        setEditHistory([...newHistory, newEdit])
        setCurrentHistoryIndex(newHistory.length)
        setCurrentImageUrl(modifiedUrl)

        // Redraw the original image on canvas for further edits
        drawImageOnCanvas()

        setIsProcessing(false)
      }

      img.src = currentImageUrl
    }, 50)
  }

  // Handle undo operation
  const handleUndo = () => {
    if (currentHistoryIndex <= -1) return

    const newIndex = currentHistoryIndex - 1
    setCurrentHistoryIndex(newIndex)

    if (newIndex === -1) {
      // Return to original image
      const canvas = document.createElement("canvas")
      canvas.width = originalImage!.width
      canvas.height = originalImage!.height
      const ctx = canvas.getContext("2d")
      ctx?.drawImage(originalImage!, 0, 0)
      setCurrentImageUrl(canvas.toDataURL("image/png"))
    } else {
      // Go to previous edit
      setCurrentImageUrl(editHistory[newIndex].imageUrl)
    }

    drawImageOnCanvas()
  }

  // Navigate to a specific point in history
  const navigateToHistoryPoint = (index: number) => {
    if (index < -1 || index >= editHistory.length) return

    setCurrentHistoryIndex(index)
    setHistoryPanelOpen(false)

    if (index === -1) {
      // Return to original image
      const canvas = document.createElement("canvas")
      canvas.width = originalImage!.width
      canvas.height = originalImage!.height
      const ctx = canvas.getContext("2d")
      ctx?.drawImage(originalImage!, 0, 0)
      setCurrentImageUrl(canvas.toDataURL("image/png"))
    } else {
      // Go to specific edit
      setCurrentImageUrl(editHistory[index].imageUrl)
    }

    drawImageOnCanvas()
  }

  // Draw the current image on canvas
  const drawImageOnCanvas = () => {
    if (!canvasRef.current || !currentImageUrl) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Set canvas dimensions to match image
      canvas.width = img.width
      canvas.height = img.height

      // Draw image
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = currentImageUrl
  }

  // Download the current image
  const downloadImage = () => {
    if (!currentImageUrl) return

    const link = document.createElement("a")
    link.href = currentImageUrl
    link.download = "edited-image.png"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Format timestamp for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  }

  // Draw image on canvas when it changes
  useEffect(() => {
    if (currentImageUrl) {
      drawImageOnCanvas()
    }
  }, [currentImageUrl])

  return (
    <div className="w-full px-2 md:px-4">
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid gap-8">
          <Card className="overflow-hidden">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h2 className="text-xl font-semibold">Image Editor</h2>
                  <div className="flex gap-2">
                    <Button onClick={handleUploadClick} variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Image
                    </Button>
                    <Button
                      onClick={() => setHistoryPanelOpen(!historyPanelOpen)}
                      variant="outline"
                      size="sm"
                      className="md:hidden"
                    >
                      <History className="w-4 h-4 mr-2" />
                      History
                    </Button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </div>

                <div className="relative border rounded-md overflow-hidden bg-muted/30 min-h-[300px] flex items-center justify-center">
                  {currentImageUrl ? (
                    <canvas
                      ref={canvasRef}
                      onClick={handleCanvasClick}
                      className={`max-w-full max-h-[400px] object-contain ${isPickingColor ? "cursor-crosshair" : "cursor-default"}`}
                    />
                  ) : (
                    <div className="text-center p-8 text-muted-foreground">
                      <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Upload an image to get started</p>
                    </div>
                  )}
                </div>

                {currentImageUrl && (
                  <div className="grid gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setIsPickingColor(true)}
                        variant={isPickingColor ? "default" : "outline"}
                        disabled={!currentImageUrl}
                        className="flex-1"
                      >
                        <Pipette className="w-4 h-4 mr-2" />
                        {isPickingColor ? "Click on image to select color" : "Select Color"}
                      </Button>

                      <div
                        className="w-10 h-10 rounded-md border"
                        style={{ backgroundColor: selectedColor || "#ffffff" }}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="replacement-color">Replacement Color</Label>
                      <div className="flex gap-2">
                        <input
                          id="replacement-color"
                          type="color"
                          value={replacementColor}
                          onChange={(e) => setReplacementColor(e.target.value)}
                          className="w-10 h-10 rounded-md border p-0"
                        />
                        <input
                          type="text"
                          value={replacementColor}
                          onChange={(e) => setReplacementColor(e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-md"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="flex justify-between">
                        <Label htmlFor="tolerance">Color Tolerance</Label>
                        <span className="text-sm text-muted-foreground">{tolerance[0]}</span>
                      </div>
                      <Slider id="tolerance" min={0} max={255} step={1} value={tolerance} onValueChange={setTolerance} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={processImage} disabled={!selectedColor || isProcessing} className="flex-1 min-w-[120px]">
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Replace Color"
                        )}
                      </Button>

                      <Button onClick={handleUndo} disabled={currentHistoryIndex < 0} variant="outline" className="flex-grow-0">
                        <Undo className="w-4 h-4 mr-2" />
                        Undo
                      </Button>

                      <Button onClick={downloadImage} disabled={!currentImageUrl} variant="outline" className="flex-grow-0">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History Panel - Desktop (hidden on mobile until toggled) */}
        <Card className={`overflow-hidden h-fit md:block ${historyPanelOpen ? "fixed inset-0 z-50 m-4 md:relative md:inset-auto md:m-0" : "hidden"}`}>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col gap-4 w-full md:w-[300px]">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Edit History</h2>
                <Button onClick={() => setHistoryPanelOpen(false)} variant="ghost" size="icon" className="md:hidden">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {editHistory.length > 0 ? (
                <ScrollArea className="h-[60vh] md:h-[500px] pr-4">
                  <div className="flex flex-col gap-4">
                    <div
                      className={`p-3 border rounded-md cursor-pointer transition-colors ${
                        currentHistoryIndex === -1 ? "bg-muted" : "hover:bg-muted/50"
                      }`}
                      onClick={() => navigateToHistoryPoint(-1)}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Original Image</span>
                      </div>
                      {originalImage && (
                        <div className="relative aspect-video bg-black/5 rounded overflow-hidden">
                          <img
                            src={originalImage.src || "/placeholder.svg"}
                            alt="Original"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </div>

                    <Separator />

                    {editHistory.map((edit, index) => (
                      <div
                        key={edit.id}
                        className={`p-3 border rounded-md cursor-pointer transition-colors ${
                          currentHistoryIndex === index ? "bg-muted" : "hover:bg-muted/50"
                        }`}
                        onClick={() => navigateToHistoryPoint(index)}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <Badge variant="outline">Edit {index + 1}</Badge>
                          <span className="text-xs text-muted-foreground">{formatTime(edit.timestamp)}</span>
                        </div>

                        <div className="relative aspect-video bg-black/5 rounded overflow-hidden mb-3">
                          <img
                            src={edit.imageUrl || "/placeholder.svg"}
                            alt={`Edit ${index + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <Label className="text-xs">From</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <div
                                className="w-4 h-4 rounded-sm border"
                                style={{ backgroundColor: edit.originalColor }}
                              />
                              <span className="text-xs">{edit.originalColor}</span>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs">To</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <div
                                className="w-4 h-4 rounded-sm border"
                                style={{ backgroundColor: edit.replacementColor }}
                              />
                              <span className="text-xs">{edit.replacementColor}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2">
                          <Label className="text-xs">Tolerance: {edit.tolerance}</Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No edits yet</p>
                  <p className="text-sm mt-2">Replace colors to build your edit history</p>
                </div>
              )}

              {editHistory.length > 0 && (
                <div className="flex justify-between">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={currentHistoryIndex <= -1}
                          onClick={() => navigateToHistoryPoint(currentHistoryIndex - 1)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Previous edit</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <span className="text-sm py-2">
                    {currentHistoryIndex + 1} of {editHistory.length}
                  </span>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={currentHistoryIndex >= editHistory.length - 1}
                          onClick={() => navigateToHistoryPoint(currentHistoryIndex + 1)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Next edit</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

