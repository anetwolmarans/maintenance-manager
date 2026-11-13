'use client'

import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eraser } from 'lucide-react'

interface Props {
  value: string | null
  onChange: (dataUrl: string | null) => void
  width?: number
  height?: number
}

/** Signature pad for tablets/phones – draw with finger or stylus, exports PNG data URL. */
export function SignaturePad({ value, onChange, width = 480, height = 180 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  const [empty, setEmpty] = useState(!value)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // scale canvas backing store for devicePixelRatio for crisp lines
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
    if (value) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height)
        hasInk.current = true
      }
      img.src = value
    }
  }, [width, height, value])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    drawing.current = true
    hasInk.current = true
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setEmpty(false)
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas && hasInk.current) {
      // flatten onto white background so the PNG works in PDFs
      const out = document.createElement('canvas')
      out.width = canvas.width
      out.height = canvas.height
      const octx = out.getContext('2d')!
      octx.fillStyle = '#ffffff'
      octx.fillRect(0, 0, out.width, out.height)
      octx.drawImage(canvas, 0, 0)
      onChange(out.toDataURL('image/png'))
    }
  }
  const clear = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    ctx.clearRect(0, 0, width * dpr, height * dpr)
    hasInk.current = false
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width, maxWidth: '100%', height, touchAction: 'none' }}
        className="rounded-lg border-2 border-dashed border-slate-300 bg-white cursor-crosshair"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        aria-label="Signature area – sign with finger or stylus"
        role="img"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{empty ? 'Sign above with finger or stylus' : 'Signature captured'}</p>
        <Button type="button" variant="ghost" size="sm" onClick={clear} className="h-8">
          <Eraser className="h-4 w-4 mr-1" /> Clear
        </Button>
      </div>
    </div>
  )
}
