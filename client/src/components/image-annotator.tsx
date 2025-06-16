import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Pencil, 
  Eraser, 
  Undo2, 
  Redo2, 
  RotateCcw, 
  Palette,
  Check,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ImageAnnotatorProps {
  imageUrl: string;
  onImageUpdated: (image: string) => void;
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
  '#FF0000', // 紅色
  '#0000FF', // 藍色
  '#00FF00', // 綠色
  '#FFFF00', // 黃色
  '#FFA500', // 橙色
  '#800080', // 紫色
  '#FFFFFF', // 白色
  '#000000', // 黑色
];

const BRUSH_SIZES = [2, 4, 6, 8, 12, 16, 20];

export function ImageAnnotator({ imageUrl, onImageUpdated, isOpen, onClose }: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [currentLineWidth, setCurrentLineWidth] = useState(4);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);
  const [undoStack, setUndoStack] = useState<DrawPath[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawPath[][]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBrushSizes, setShowBrushSizes] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { toast } = useToast();

  // Load and setup canvases
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      imageRef.current = image;
      setImageLoaded(true);
      setupCanvases(image);
    };
    image.src = imageUrl;

    return () => {
      setImageLoaded(false);
      setPaths([]);
      setUndoStack([]);
      setRedoStack([]);
    };
  }, [isOpen, imageUrl]);

  const setupCanvases = (image: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const backgroundCanvas = backgroundCanvasRef.current;
    const container = containerRef.current;
    
    if (!canvas || !backgroundCanvas || !container) return;

    const containerRect = container.getBoundingClientRect();
    const maxWidth = containerRect.width - 32; // Account for padding
    const maxHeight = window.innerHeight * 0.6;

    // Calculate display dimensions maintaining aspect ratio
    const aspectRatio = image.width / image.height;
    let displayWidth = maxWidth;
    let displayHeight = displayWidth / aspectRatio;

    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * aspectRatio;
    }

    // Set canvas dimensions
    const dpr = window.devicePixelRatio || 1;
    
    [canvas, backgroundCanvas].forEach(canv => {
      canv.style.width = `${displayWidth}px`;
      canv.style.height = `${displayHeight}px`;
      canv.width = displayWidth * dpr;
      canv.height = displayHeight * dpr;
      
      const ctx = canv.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    });

    // Draw background image
    const bgCtx = backgroundCanvas.getContext('2d');
    if (bgCtx) {
      bgCtx.drawImage(image, 0, 0, displayWidth, displayHeight);
    }

    // Clear annotation canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, displayWidth, displayHeight);
    }
  };

  const redrawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const displayWidth = canvas.width / (window.devicePixelRatio || 1);
    const displayHeight = canvas.height / (window.devicePixelRatio || 1);

    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Redraw all paths
    paths.forEach(path => {
      if (path.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.lineWidth;
      ctx.globalCompositeOperation = path.tool === 'eraser' ? 'destination-out' : 'source-over';

      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });

    ctx.globalCompositeOperation = 'source-over';
  }, [paths]);

  useEffect(() => {
    if (imageLoaded) {
      redrawAnnotations();
    }
  }, [imageLoaded, redrawAnnotations]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): DrawPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
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

    // Draw current stroke
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentLineWidth;
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';

    const points = updatedPath.points;
    if (points.length >= 2) {
      const lastPoint = points[points.length - 2];
      const currentPoint = points[points.length - 1];
      
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
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

  const clearAnnotations = () => {
    setUndoStack(prev => [...prev, paths]);
    setRedoStack([]);
    setPaths([]);
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      const displayWidth = canvas.width / (window.devicePixelRatio || 1);
      const displayHeight = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, displayWidth, displayHeight);
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

  const saveAnnotatedImage = () => {
    const backgroundCanvas = backgroundCanvasRef.current;
    const annotationCanvas = canvasRef.current;
    
    if (!backgroundCanvas || !annotationCanvas) return;

    // Create a new canvas to combine both layers
    const combinedCanvas = document.createElement('canvas');
    const combinedCtx = combinedCanvas.getContext('2d');
    
    if (!combinedCtx) return;

    combinedCanvas.width = backgroundCanvas.width;
    combinedCanvas.height = backgroundCanvas.height;

    // Draw background image
    combinedCtx.drawImage(backgroundCanvas, 0, 0);
    
    // Draw annotations on top
    combinedCtx.drawImage(annotationCanvas, 0, 0);

    const dataURL = combinedCanvas.toDataURL('image/png');
    onImageUpdated(dataURL);
    onClose();
    
    toast({
      title: "標註已保存",
      description: "圖片標註已完成並保存",
      variant: "success",
    });
  };

  if (!imageLoaded) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>載入中...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-semibold">圖片標註</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
            {/* Tools */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={currentTool === 'pen' ? 'default' : 'outline'}
                onClick={() => setCurrentTool('pen')}
                className="h-9"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={currentTool === 'eraser' ? 'default' : 'outline'}
                onClick={() => setCurrentTool('eraser')}
                className="h-9"
              >
                <Eraser className="h-4 w-4" />
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
                onClick={clearAnnotations}
                className="h-9"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Canvas Container */}
          <div 
            ref={containerRef}
            className="relative border rounded-lg overflow-hidden bg-white flex justify-center"
          >
            <div className="relative">
              {/* Background image canvas */}
              <canvas
                ref={backgroundCanvasRef}
                className="absolute top-0 left-0 block"
              />
              {/* Annotation canvas */}
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 block cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={saveAnnotatedImage} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-2" />
              完成標註
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}