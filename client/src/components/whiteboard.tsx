import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Pencil, 
  Eraser, 
  Undo2, 
  Redo2, 
  RotateCcw, 
  Download,
  Palette,
  Minus,
  Plus,
  Check,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WhiteboardProps {
  onImageGenerated: (image: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface DrawPoint {
  x: number;
  y: number;
}

interface DrawPath {
  points: DrawPoint[];
  color: string;
  lineWidth: number;
  tool: 'pen' | 'eraser';
}

const COLORS = [
  '#000000', // 黑色
  '#FF0000', // 紅色
  '#0000FF', // 藍色
  '#00FF00', // 綠色
  '#FFA500', // 橙色
  '#800080', // 紫色
  '#FFD700', // 金色
  '#FF69B4', // 粉紅色
];

const BRUSH_SIZES = [1, 2, 3, 4, 6, 8, 12];

export function Whiteboard({ onImageGenerated, isOpen, onClose }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [currentLineWidth, setCurrentLineWidth] = useState(2);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);
  const [undoStack, setUndoStack] = useState<DrawPath[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawPath[][]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBrushSizes, setShowBrushSizes] = useState(false);
  const { toast } = useToast();

  // Clean up state when whiteboard opens
  useEffect(() => {
    if (isOpen) {
      setPaths([]);
      setCurrentPath(null);
      setUndoStack([]);
      setRedoStack([]);
      setIsDrawing(false);
      setShowColorPicker(false);
      setShowBrushSizes(false);
    }
  }, [isOpen]);

  // Initialize canvas
  useEffect(() => {
    if (!isOpen) return;
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      
      // Use the full container dimensions with minimal margin
      const margin = 4;
      const displayWidth = rect.width - margin * 2;
      const displayHeight = rect.height - margin * 2;
      
      // Set display size to fill the entire container
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      
      // Set actual canvas resolution
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      
      // Setup context with optimized settings for crisp drawing
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = false; // Disable for sharper lines
        ctx.globalCompositeOperation = 'source-over';
        
        // Fill with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, displayWidth, displayHeight);
        
        // Redraw all paths
        redrawCanvas();
      }
    };

    // Initial resize immediately and with backup timing
    resizeCanvas();
    const timeoutId = setTimeout(resizeCanvas, 50);
    window.addEventListener('resize', resizeCanvas);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isOpen]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear and fill with white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw all paths with smooth curves
    paths.forEach(path => {
      if (path.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = path.tool === 'eraser' ? '#ffffff' : path.color;
      ctx.lineWidth = path.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = path.tool === 'eraser' ? 'destination-out' : 'source-over';

      // Draw with smooth curves for better quality
      if (path.points.length >= 3) {
        ctx.moveTo(path.points[0].x, path.points[0].y);
        
        for (let i = 1; i < path.points.length - 1; i++) {
          const currentPoint = path.points[i];
          const nextPoint = path.points[i + 1];
          const midPoint = {
            x: (currentPoint.x + nextPoint.x) / 2,
            y: (currentPoint.y + nextPoint.y) / 2
          };
          
          ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, midPoint.x, midPoint.y);
        }
        
        // Draw to the last point
        const lastPoint = path.points[path.points.length - 1];
        const secondLastPoint = path.points[path.points.length - 2];
        ctx.quadraticCurveTo(secondLastPoint.x, secondLastPoint.y, lastPoint.x, lastPoint.y);
      } else {
        // Fallback for simple lines
        ctx.moveTo(path.points[0].x, path.points[0].y);
        ctx.lineTo(path.points[1].x, path.points[1].y);
      }
      ctx.stroke();
    });

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
  }, [paths]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): DrawPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // Calculate scaling factors between display size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getCanvasPoint(e);
    const newPath: DrawPath = {
      points: [point],
      color: currentColor,
      lineWidth: currentLineWidth,
      tool: currentTool,
    };

    setCurrentPath(newPath);
    setIsDrawing(true);
    
    // Save state for undo
    setUndoStack(prev => [...prev, paths]);
    setRedoStack([]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentPath) return;
    
    e.preventDefault();
    const point = getCanvasPoint(e);
    const updatedPath = {
      ...currentPath,
      points: [...currentPath.points, point],
    };

    setCurrentPath(updatedPath);

    // Draw current stroke with smooth curves
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
    ctx.lineWidth = currentLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';

    const points = updatedPath.points;
    if (points.length >= 2) {
      const lastPoint = points[points.length - 2];
      const currentPoint = points[points.length - 1];
      
      // Use quadratic curves for smoother lines when we have enough points
      if (points.length >= 3) {
        const secondLastPoint = points[points.length - 3];
        const midPoint = {
          x: (lastPoint.x + currentPoint.x) / 2,
          y: (lastPoint.y + currentPoint.y) / 2
        };
        
        ctx.moveTo(secondLastPoint.x, secondLastPoint.y);
        ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
      } else {
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
      }
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
  };

  const stopDrawing = () => {
    if (currentPath && currentPath.points.length > 0) {
      setPaths(prev => [...prev, currentPath]);
    }
    setCurrentPath(null);
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    setUndoStack(prev => [...prev, paths]);
    setRedoStack([]);
    setPaths([]);
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const undo = () => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setRedoStack(prev => [paths, ...prev]);
      setPaths(previousState);
      setUndoStack(prev => prev.slice(0, -1));
    }
  };

  const redo = () => {
    if (redoStack.length > 0) {
      const nextState = redoStack[0];
      setUndoStack(prev => [...prev, paths]);
      setPaths(nextState);
      setRedoStack(prev => prev.slice(1));
    }
  };

  const saveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a new canvas maintaining the original aspect ratio
    const outputCanvas = document.createElement('canvas');
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) return;

    // Preserve the original canvas aspect ratio
    const originalAspectRatio = canvas.width / canvas.height;
    const maxDimension = 800; // Maximum size for either width or height

    let outputWidth, outputHeight;

    // Scale down while maintaining aspect ratio
    if (canvas.width >= canvas.height) {
      // Landscape or square - limit by width
      outputWidth = Math.min(canvas.width, maxDimension);
      outputHeight = outputWidth / originalAspectRatio;
    } else {
      // Portrait - limit by height  
      outputHeight = Math.min(canvas.height, maxDimension);
      outputWidth = outputHeight * originalAspectRatio;
    }

    // Set output canvas dimensions to exact original proportions
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;

    // Fill with white background
    outputCtx.fillStyle = '#ffffff';
    outputCtx.fillRect(0, 0, outputWidth, outputHeight);

    // Draw the original canvas content maintaining exact proportions
    outputCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, outputWidth, outputHeight);

    const dataURL = outputCanvas.toDataURL('image/png', 0.95);
    onImageGenerated(dataURL);
    onClose();
    
    toast({
      title: "白板已保存",
      description: "白板內容已轉換為圖片",
      variant: "success",
    });
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create output canvas maintaining original aspect ratio (same logic as saveImage)
    const outputCanvas = document.createElement('canvas');
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) return;

    const originalAspectRatio = canvas.width / canvas.height;
    const maxDimension = 800;

    let outputWidth, outputHeight;

    if (canvas.width >= canvas.height) {
      outputWidth = Math.min(canvas.width, maxDimension);
      outputHeight = outputWidth / originalAspectRatio;
    } else {
      outputHeight = Math.min(canvas.height, maxDimension);
      outputWidth = outputHeight * originalAspectRatio;
    }

    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;

    outputCtx.fillStyle = '#ffffff';
    outputCtx.fillRect(0, 0, outputWidth, outputHeight);
    outputCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, outputWidth, outputHeight);

    const link = document.createElement('a');
    link.download = `whiteboard-${new Date().getTime()}.png`;
    link.href = outputCanvas.toDataURL('image/png', 0.95);
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
          <DialogTitle className="text-lg sm:text-xl font-semibold">手寫白板</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4 sm:px-6 flex flex-col h-[calc(95vh-80px)]">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2 p-2 bg-muted/50 rounded-lg flex-shrink-0">
            {/* Tools */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={currentTool === 'pen' ? 'default' : 'outline'}
                onClick={() => setCurrentTool('pen')}
                className="h-8 sm:h-9 px-2 sm:px-3"
              >
                <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline ml-1">筆</span>
              </Button>
              <Button
                size="sm"
                variant={currentTool === 'eraser' ? 'default' : 'outline'}
                onClick={() => setCurrentTool('eraser')}
                className="h-8 sm:h-9 px-2 sm:px-3"
              >
                <Eraser className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline ml-1">擦</span>
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Color Picker */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="h-9 gap-2"
              >
                <div 
                  className="w-4 h-4 rounded border border-border"
                  style={{ backgroundColor: currentColor }}
                />
                <Palette className="h-4 w-4" />
              </Button>
              
              {showColorPicker && (
                <div className="absolute top-full mt-1 z-10 p-2 bg-background border rounded-lg shadow-lg">
                  <div className="grid grid-cols-4 gap-1">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        className={cn(
                          "w-8 h-8 rounded border-2 transition-all",
                          currentColor === color ? "border-primary scale-110" : "border-border hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          setCurrentColor(color);
                          setShowColorPicker(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Brush Size */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBrushSizes(!showBrushSizes)}
                className="h-9 gap-2"
              >
                <div 
                  className="rounded-full bg-current"
                  style={{ 
                    width: Math.max(4, Math.min(16, currentLineWidth)), 
                    height: Math.max(4, Math.min(16, currentLineWidth)) 
                  }}
                />
                <span className="text-xs">{currentLineWidth}</span>
              </Button>
              
              {showBrushSizes && (
                <div className="absolute top-full mt-1 z-10 p-2 bg-background border rounded-lg shadow-lg">
                  <div className="flex flex-col gap-1">
                    {BRUSH_SIZES.map(size => (
                      <button
                        key={size}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded hover:bg-muted transition-colors",
                          currentLineWidth === size && "bg-muted"
                        )}
                        onClick={() => {
                          setCurrentLineWidth(size);
                          setShowBrushSizes(false);
                        }}
                      >
                        <div 
                          className="rounded-full bg-current"
                          style={{ width: size, height: size }}
                        />
                        <span className="text-sm">{size}px</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={undo}
                disabled={undoStack.length === 0}
                className="h-9"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={redo}
                disabled={redoStack.length === 0}
                className="h-9"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={clearCanvas}
                className="h-9"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <Button
              size="sm"
              variant="outline"
              onClick={downloadImage}
              className="h-9"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>

          {/* Canvas Container */}
          <div 
            ref={containerRef}
            className="relative rounded-lg overflow-hidden bg-white w-full flex-1"
            style={{ minHeight: 'calc(100vh - 300px)' }}
          >
            <canvas
              ref={canvasRef}
              className="block cursor-crosshair touch-none w-full h-full"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 mt-2 pt-2 border-t flex-shrink-0">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={saveImage} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-2" />
              完成並使用
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}