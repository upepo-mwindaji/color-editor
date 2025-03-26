import { ImageColorEditor } from "@/components/image-color-editor"

export default function Home() {
  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Image Color Editor</h1>
      <p className="text-center mb-8 text-muted-foreground">
        Upload an image, replace colors, localy processed in your browser
      </p>
      <ImageColorEditor />
    </main>
  )
}

