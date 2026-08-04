import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Floating call card position, size, minimize bubble, and drag/resize handlers.
 */
export function useCallCardChrome(callStatus) {
  const [cardPos, setCardPos] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [bubblePos, setBubblePos] = useState({
    x: typeof window !== 'undefined' ? window.innerWidth - 80 : 300,
    y: typeof window !== 'undefined' ? window.innerHeight - 120 : 400
  });
  const [cardSize, setCardSize] = useState({ width: 320, height: 440 });

  const isDraggingCard = useRef(false);
  const cardDragStart = useRef({ x: 0, y: 0 });
  const cardElementStart = useRef({ x: 0, y: 0 });
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ width: 0, height: 0 });
  const isDraggingBubble = useRef(false);
  const bubbleDragStart = useRef({ x: 0, y: 0 });
  const bubbleElementStart = useRef({ x: 0, y: 0 });
  const clickPrevented = useRef(false);

  const handleResizeMouseMove = useCallback((e) => {
    if (!isResizing.current) return;
    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;
    setCardSize((prevSize) => {
      // cardPos read via closure on mousedown path — use functional width clamp with window
      const maxW = window.innerWidth - 12;
      const maxH = window.innerHeight - 12;
      return {
        width: Math.max(320, Math.min(maxW, sizeStart.current.width + dx)),
        height: Math.max(400, Math.min(maxH, sizeStart.current.height + dy))
      };
    });
  }, []);

  const handleResizeMouseUp = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleResizeMouseMove);
    document.removeEventListener('mouseup', handleResizeMouseUp);
  }, [handleResizeMouseMove]);

  const handleResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY };
    sizeStart.current = { ...cardSize };
    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
  }, [cardSize, handleResizeMouseMove, handleResizeMouseUp]);

  const handleResizeTouchMove = useCallback((e) => {
    if (!isResizing.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - resizeStart.current.x;
    const dy = touch.clientY - resizeStart.current.y;
    setCardSize({
      width: Math.max(320, Math.min(window.innerWidth - 12, sizeStart.current.width + dx)),
      height: Math.max(400, Math.min(window.innerHeight - 12, sizeStart.current.height + dy))
    });
  }, []);

  const handleResizeTouchEnd = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('touchmove', handleResizeTouchMove);
    document.removeEventListener('touchend', handleResizeTouchEnd);
  }, [handleResizeTouchMove]);

  const handleResizeTouchStart = useCallback((e) => {
    e.stopPropagation();
    isResizing.current = true;
    const touch = e.touches[0];
    resizeStart.current = { x: touch.clientX, y: touch.clientY };
    sizeStart.current = { ...cardSize };
    document.addEventListener('touchmove', handleResizeTouchMove, { passive: false });
    document.addEventListener('touchend', handleResizeTouchEnd);
  }, [cardSize, handleResizeTouchMove, handleResizeTouchEnd]);

  const handleCardMouseMove = useCallback((e) => {
    if (!isDraggingCard.current) return;
    const dx = e.clientX - cardDragStart.current.x;
    const dy = e.clientY - cardDragStart.current.y;
    let newX = cardElementStart.current.x + dx;
    let newY = cardElementStart.current.y + dy;
    const maxX = window.innerWidth - cardSize.width - 12;
    const maxY = window.innerHeight - cardSize.height - 12;
    newX = Math.max(12, Math.min(newX, maxX));
    newY = Math.max(12, Math.min(newY, maxY));
    setCardPos({ x: newX, y: newY });
  }, [cardSize.height, cardSize.width]);

  const handleCardMouseUp = useCallback(() => {
    isDraggingCard.current = false;
    document.removeEventListener('mousemove', handleCardMouseMove);
    document.removeEventListener('mouseup', handleCardMouseUp);
  }, [handleCardMouseMove]);

  const handleCardMouseDown = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('.local-video-preview') || e.target.closest('.call-resize-handle')) return;
    e.preventDefault();
    isDraggingCard.current = true;
    cardDragStart.current = { x: e.clientX, y: e.clientY };
    cardElementStart.current = { x: cardPos?.x || 0, y: cardPos?.y || 0 };
    document.addEventListener('mousemove', handleCardMouseMove);
    document.addEventListener('mouseup', handleCardMouseUp);
  }, [cardPos, handleCardMouseMove, handleCardMouseUp]);

  const handleCardTouchMove = useCallback((e) => {
    if (!isDraggingCard.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - cardDragStart.current.x;
    const dy = touch.clientY - cardDragStart.current.y;
    let newX = cardElementStart.current.x + dx;
    let newY = cardElementStart.current.y + dy;
    const maxX = window.innerWidth - cardSize.width - 12;
    const maxY = window.innerHeight - cardSize.height - 12;
    newX = Math.max(12, Math.min(newX, maxX));
    newY = Math.max(12, Math.min(newY, maxY));
    setCardPos({ x: newX, y: newY });
  }, [cardSize.height, cardSize.width]);

  const handleCardTouchEnd = useCallback(() => {
    isDraggingCard.current = false;
    document.removeEventListener('touchmove', handleCardTouchMove);
    document.removeEventListener('touchend', handleCardTouchEnd);
  }, [handleCardTouchMove]);

  const handleCardTouchStart = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('.local-video-preview') || e.target.closest('.call-resize-handle')) return;
    isDraggingCard.current = true;
    const touch = e.touches[0];
    cardDragStart.current = { x: touch.clientX, y: touch.clientY };
    cardElementStart.current = { x: cardPos?.x || 0, y: cardPos?.y || 0 };
    document.addEventListener('touchmove', handleCardTouchMove, { passive: false });
    document.addEventListener('touchend', handleCardTouchEnd);
  }, [cardPos, handleCardTouchMove, handleCardTouchEnd]);

  const handleBubbleMouseMove = useCallback((e) => {
    if (!isDraggingBubble.current) return;
    const dx = e.clientX - bubbleDragStart.current.x;
    const dy = e.clientY - bubbleDragStart.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) clickPrevented.current = true;
    let newX = bubbleElementStart.current.x + dx;
    let newY = bubbleElementStart.current.y + dy;
    newX = Math.max(10, Math.min(newX, window.innerWidth - 70));
    newY = Math.max(10, Math.min(newY, window.innerHeight - 70));
    setBubblePos({ x: newX, y: newY });
  }, []);

  const handleBubbleMouseUp = useCallback(() => {
    isDraggingBubble.current = false;
    document.removeEventListener('mousemove', handleBubbleMouseMove);
    document.removeEventListener('mouseup', handleBubbleMouseUp);
  }, [handleBubbleMouseMove]);

  const handleBubbleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDraggingBubble.current = true;
    clickPrevented.current = false;
    bubbleDragStart.current = { x: e.clientX, y: e.clientY };
    bubbleElementStart.current = { x: bubblePos.x, y: bubblePos.y };
    document.addEventListener('mousemove', handleBubbleMouseMove);
    document.addEventListener('mouseup', handleBubbleMouseUp);
  }, [bubblePos.x, bubblePos.y, handleBubbleMouseMove, handleBubbleMouseUp]);

  const handleBubbleTouchMove = useCallback((e) => {
    if (!isDraggingBubble.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - bubbleDragStart.current.x;
    const dy = touch.clientY - bubbleDragStart.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) clickPrevented.current = true;
    let newX = bubbleElementStart.current.x + dx;
    let newY = bubbleElementStart.current.y + dy;
    newX = Math.max(10, Math.min(newX, window.innerWidth - 70));
    newY = Math.max(10, Math.min(newY, window.innerHeight - 70));
    setBubblePos({ x: newX, y: newY });
  }, []);

  const handleBubbleTouchEnd = useCallback(() => {
    isDraggingBubble.current = false;
    document.removeEventListener('touchmove', handleBubbleTouchMove);
    document.removeEventListener('touchend', handleBubbleTouchEnd);
  }, [handleBubbleTouchMove]);

  const handleBubbleTouchStart = useCallback((e) => {
    isDraggingBubble.current = true;
    clickPrevented.current = false;
    const touch = e.touches[0];
    bubbleDragStart.current = { x: touch.clientX, y: touch.clientY };
    bubbleElementStart.current = { x: bubblePos.x, y: bubblePos.y };
    document.addEventListener('touchmove', handleBubbleTouchMove, { passive: false });
    document.addEventListener('touchend', handleBubbleTouchEnd);
  }, [bubblePos.x, bubblePos.y, handleBubbleTouchMove, handleBubbleTouchEnd]);

  const handleBubbleClick = useCallback((e) => {
    if (clickPrevented.current) {
      e.stopPropagation();
      return;
    }
    setIsMinimized(false);
  }, []);

  useEffect(() => {
    if (callStatus !== 'idle') {
      setIsMinimized(false);
      setCardPos({
        x: Math.max(12, window.innerWidth / 2 - 160),
        y: Math.max(12, window.innerHeight / 2 - 220)
      });
      setBubblePos({
        x: window.innerWidth - 80,
        y: window.innerHeight - 120
      });
    } else {
      setCardPos(null);
    }
  }, [callStatus]);

  useEffect(() => {
    const handleResize = () => {
      setBubblePos((prev) => ({
        x: Math.min(prev.x, window.innerWidth - 70),
        y: Math.min(prev.y, window.innerHeight - 70)
      }));
      setCardPos((prev) => {
        if (!prev) return prev;
        return {
          x: Math.max(12, Math.min(prev.x, window.innerWidth - cardSize.width - 12)),
          y: Math.max(12, Math.min(prev.y, window.innerHeight - cardSize.height - 12))
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [cardSize.height, cardSize.width]);

  return {
    cardPos,
    cardSize,
    isMinimized,
    setIsMinimized,
    bubblePos,
    isDraggingCard,
    isResizing,
    handleResizeMouseDown,
    handleResizeTouchStart,
    handleCardMouseDown,
    handleCardTouchStart,
    handleBubbleMouseDown,
    handleBubbleTouchStart,
    handleBubbleClick
  };
}
