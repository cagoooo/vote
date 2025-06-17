import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Palette, Eraser, Undo, Redo, Download, Trash2, Minus, Plus } from 'lucide-react';

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
  const resizeTimeoutRef = useRef<number | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [currentLineWidth, setCurrentLineWidth] = useState(3);
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

  // Debounced canvas resize function
  const debouncedResizeCanvas = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = window.setTimeout(() => {
      if (isDrawing) return; // Don't resize while drawing
      
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      
      // Create square canvas to prevent shape distortion
      const margin = 16;
      const availableWidth = rect.width - margin * 2;
      const availableHeight = rect.height - margin * 2;
      const size = Math.min(availableWidth, availableHeight);
      const canvasSize = Math.max(size, 300);
      
      // Set canvas dimensions
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      canvas.style.width = `${canvasSize}px`;
      canvas.style.height = `${canvasSize}px`;
      
      console.log('Canvas sized to:', canvasSize, 'x', canvasSize);
      
      // Setup drawing context
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = 'source-over';
        
        // Fill background and redraw
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        redrawCanvas();
      }
    }, 200); // Debounce delay
  }, [isDrawing, redrawCanvas]);

  // Initialize canvas
  useEffect(() => {
    if (!isOpen) return;
    
    // Setup with delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      debouncedResizeCanvas();
    }, 100);
    
    // Add resize listener
    window.addEventListener('resize', debouncedResizeCanvas);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      window.removeEventListener('resize', debouncedResizeCanvas);
    };
  }, [isOpen, debouncedResizeCanvas]);

  // Prevent canvas operations during drawing
  useEffect(() => {
    if (isDrawing && resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
  }, [isDrawing]);

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
    
    // Setup drawing context immediately
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
      ctx.lineWidth = currentLineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
      
      // Start the path for continuous drawing
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
    
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

  const continueDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentPath) return;
    
    e.preventDefault();
    const point = getCanvasPoint(e);
    
    // Draw immediately with optimized performance
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      // Continue the existing path for smoother lines
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      
      // Move to current point for next line segment
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
    
    // Update path state
    setCurrentPath(prev => prev ? {
      ...prev,
      points: [...prev.points, point]
    } : null);
  };

  const stopDrawing = () => {
    if (!isDrawing || !currentPath) return;
    
    // Add completed path to paths array
    if (currentPath.points.length > 0) {
      setPaths(prev => [...prev, currentPath]);
    }
    
    setCurrentPath(null);
    setIsDrawing(false);
    
    // Save state for undo
    setUndoStack(prev => [...prev, paths]);
    setRedoStack([]);
    
    // No redraw needed since we've been drawing in real-time
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, paths]);
    setPaths(previousState);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, paths]);
    setPaths(nextState);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    // Save state for undo
    setUndoStack(prev => [...prev, paths]);
    setRedoStack([]);
    setPaths([]);

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const saveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const imageData = canvas.toDataURL('image/png');
      onImageGenerated(imageData);
      onClose();
      
      toast({
        title: "白板已儲存",
        description: "您的繪圖已成功加入問題中"
      });
    } catch (error) {
      console.error('Error saving canvas:', error);
      toast({
        title: "儲存失敗",
        description: "無法儲存白板內容，請重試",
        variant: "destructive"
      });
    }
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const link = document.createElement('a');
      link.download = `whiteboard-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>白板繪圖</DialogTitle>
        </DialogHeader>
        
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 p-4 bg-gray-50 rounded-lg">
          {/* Tool Selection */}
          <div className="flex gap-1">
            <Button
              variant={currentTool === 'pen' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentTool('pen')}
            >
              筆刷
            </Button>
            <Button
              variant={currentTool === 'eraser' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentTool('eraser')}
            >
              <Eraser className="w-4 h-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Color Picker */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColorPicker(!showColorPicker)}
            >
              <Palette className="w-4 h-4 mr-1" />
              <div 
                className="w-4 h-4 rounded border"
                style={{ backgroundColor: currentColor }}
              />
            </Button>
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white border rounded-lg shadow-lg z-10">
                <div className="grid grid-cols-4 gap-1">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded border-2 ${
                        currentColor === color ? 'border-gray-400' : 'border-gray-200'
                      }`}
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
              variant="outline"
              size="sm"
              onClick={() => setShowBrushSizes(!showBrushSizes)}
            >
              <div className="flex items-center gap-1">
                <Minus className="w-3 h-3" />
                <div 
                  className="rounded-full bg-gray-600"
                  style={{ 
                    width: `${Math.min(currentLineWidth * 2, 12)}px`,
                    height: `${Math.min(currentLineWidth * 2, 12)}px`
                  }}
                />
                <Plus className="w-3 h-3" />
              </div>
            </Button>
            {showBrushSizes && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white border rounded-lg shadow-lg z-10">
                <div className="flex flex-col gap-1">
                  {BRUSH_SIZES.map((size) => (
                    <button
                      key={size}
                      className={`flex items-center justify-center w-12 h-8 hover:bg-gray-100 rounded ${
                        currentLineWidth === size ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        setCurrentLineWidth(size);
                        setShowBrushSizes(false);
                      }}
                    >
                      <div 
                        className="rounded-full bg-gray-600"
                        style={{ 
                          width: `${Math.min(size * 2, 12)}px`,
                          height: `${Math.min(size * 2, 12)}px`
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Actions */}
          <Button variant="outline" size="sm" onClick={undo} disabled={undoStack.length === 0}>
            <Undo className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={redoStack.length === 0}>
            <Redo className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={clearCanvas}>
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={downloadImage}>
            <Download className="w-4 h-4" />
          </Button>
        </div>

        {/* Canvas Container */}
        <div 
          ref={containerRef}
          className="flex-1 flex items-center justify-center p-4 bg-gray-100 rounded-lg overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            className="border border-gray-300 rounded bg-white cursor-crosshair shadow-md"
            onMouseDown={startDrawing}
            onMouseMove={continueDrawing}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={continueDrawing}
            onTouchEnd={stopDrawing}
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={saveImage}>
            使用此繪圖
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}