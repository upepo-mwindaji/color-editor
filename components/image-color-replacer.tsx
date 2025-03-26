"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Upload, Pipette, Download, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export function ImageColorReplacer() {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null)
  const [modifiedImageUrl, setModifiedImageUrl] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [replacementColor, setReplacementColor] = useState<string>("#ff0000")
  const [isPickingColor, setIsPickingColor] = useState(false)
  const [tolerance, setTolerance] = useState([30])
  const [isProcessing, setIsProcessing] = useState(false)
  const [modificationHistory, setModificationHistory] = useState<string[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        setOriginalImage(img)
        setModifiedImageUrl(null)
        setSelectedColor(null)
        setModificationHistory([]) // Reset history for new image
      }
      img.crossOrigin = "anonymous" // Add this to avoid CORS issues with canvas
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Handle color picking from the image
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickingColor || !canvasRef.current || !originalImage) return

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
    if (!originalImage || !selectedColor || !canvasRef.current) return

    setIsProcessing(true)

    // Save current state to history if we have a modified image
    if (modifiedImageUrl) {
      setModificationHistory((prev) => [...prev, modifiedImageUrl])
    }

    // Use setTimeout to allow the UI to update before heavy processing
    setTimeout(() => {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext("2d")!

      // Get the selected color as RGB
      const selectedR = Number.parseInt(selectedColor.slice(1, 3), 16)
      const selectedG = Number.parseInt(selectedColor.slice(3, 5), 16)
      const selectedB = Number.parseInt(selectedColor.slice(5, 7), 16)

      // Get the replacement color as RGB
      const replacementR = Number.parseInt(replacementColor.slice(1, 3), 16)
      const replacementG = Number.parseInt(replacementColor.slice(3, 5), 16)
      const replacementB = Number.parseInt(replacementColor.slice(5, 7), 16)

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const colorTolerance = tolerance[0]

      // Replace colors
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        // Calculate color distance (simple Euclidean distance)
        const distance = Math.sqrt(Math.pow(r - selectedR, 2) + Math.pow(g - selectedG, 2) + Math.pow(b - selectedB, 2))

        // Replace color if within tolerance
        if (distance <= colorTolerance) {
          data[i] = replacementR
          data[i + 1] = replacementG
          data[i + 2] = replacementB
        }
      }

      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0)

      // Convert canvas to data URL
      const modifiedUrl = canvas.toDataURL("image/png")
      setModifiedImageUrl(modifiedUrl)

      // Redraw the original image on canvas for further edits
      drawImageOnCanvas(originalImage)

      setIsProcessing(false)
    }, 50)
  }

  const handleUndo = () => {
    if (modificationHistory.length === 0) return

    // Get the last state from history
    const previousState = modificationHistory[modificationHistory.length - 1]

    // Update the modified image
    setModifiedImageUrl(previousState)

    // Remove the last state from history
    setModificationHistory((prev) => prev.slice(0, -1))
  }

  // Draw the image on canvas
  const drawImageOnCanvas = (img: HTMLImageElement) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions to match image
    canvas.width = img.width
    canvas.height = img.height

    // Draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
  }

  // Download the modified image
  const downloadImage = () => {
    if (!modifiedImageUrl) return

    const link = document.createElement("a")
    link.href = modifiedImageUrl
    link.download = "modified-image.png"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Draw image on canvas when it changes
  useEffect(() => {
    if (originalImage) {
      drawImageOnCanvas(originalImage)
    }
  }, [originalImage])

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Original Image</h2>
              <Button onClick={handleUploadClick} variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>

            <div className="relative border rounded-md overflow-hidden bg-muted/30 min-h-[300px] flex items-center justify-center">
              {originalImage ? (
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

            {originalImage && (
              <div className="grid gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setIsPickingColor(true)}
                    variant={isPickingColor ? "default" : "outline"}
                    disabled={!originalImage}
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

                <Button onClick={processImage} disabled={!selectedColor || isProcessing} className="w-full">
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Replace Color"
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Modified Image</h2>
              <div className="flex gap-2">
                {modificationHistory.length > 0 && (
                  <Button onClick={handleUndo} variant="outline" size="sm">
                    Undo
                  </Button>
                )}
                {modifiedImageUrl && (
                  <Button onClick={downloadImage} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>

            <div className="relative border rounded-md overflow-hidden bg-muted/30 min-h-[300px] flex items-center justify-center">
              {modifiedImageUrl ? (
                <img
                  src={modifiedImageUrl || "/placeholder.svg"}
                  alt="Modified"
                  className="max-w-full max-h-[400px] object-contain"
                />
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  <p>Modified image will appear here</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

