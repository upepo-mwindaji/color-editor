'use client'

import { useState } from 'react'
import { ImageColorEditor } from "@/components/image-color-editor"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { HelpCircle } from 'lucide-react'

export default function Home() {
  return (
    <main className="container mx-auto py-4 px-4">
      <div className="flex items-center justify-center mb-4 gap-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 via-blue-500 through-purple-600 to-teal-400 bg-clip-text text-transparent">
          Image Color Editor
        </h1>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full [&_svg]:size-8 text-[#6a73dd] hover:text-[#ef297f]">
              <HelpCircle />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle></DrawerTitle>
            </DrawerHeader>
            <div className="space-y-4 flex flex-col gap-4 pb-12 px-4">
              <h2 className="text-lg font-bold">What is this?</h2>
              <p>A simple tool that allows you to edit the colors of an image.</p>
              <p>The processing is done in your browser. Nothing is saved or shared over the internet. You can use if offline</p>
              <h2 className="text-lg font-bold">How to use ?</h2>
              <ol className="list-decimal list-inside flex flex-col items-start justify-start text-left gap-2">
                <li>Upload an image</li>
                <li>Click "Select Color" button then pick a color in the image to select it</li>
                <li>Choose a replacement color</li>
                <li>Click "replace" button</li>
                <li>The image will be processed locally in your browser and saved in the history until you close or refresh.</li>
                <li>Make sure to click "Download" to save edits you like, as they will be lost after closing the browser or refreshing the page.</li>
                <li>You can undo using the "Undo" button go or edit back an image from the history by clicking "History" then the button</li>
              </ol>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
      <ImageColorEditor />
    </main>
  )
}

