import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Draggable local video PiP inside the call card.
 */
export function useCallLocalPreviewDrag({ containerRef, localVideoStream, cardSize }) {
  const [dragPos, setDragPos] = useState({ x: 318, y: 12 });
  const dragRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const elementStart = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (containerRef.current && dragRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elementRect = dragRef.current.getBoundingClientRect();
      let newX = elementStart.current.x + dx;
      let newY = elementStart.current.y + dy;
      const maxX = containerRect.width - elementRect.width - 12;
      const maxY = containerRect.height - elementRect.height - 12;
      newX = Math.max(12, Math.min(newX, maxX));
      newY = Math.max(12, Math.min(newY, maxY));
      setDragPos({ x: newX, y: newY });
    }
  }, [containerRef]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    elementStart.current = { x: dragPos.x, y: dragPos.y };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dragPos.x, dragPos.y, handleMouseMove, handleMouseUp]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.current.x;
    const dy = touch.clientY - dragStart.current.y;
    if (containerRef.current && dragRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elementRect = dragRef.current.getBoundingClientRect();
      let newX = elementStart.current.x + dx;
      let newY = elementStart.current.y + dy;
      const maxX = containerRect.width - elementRect.width - 12;
      const maxY = containerRect.height - elementRect.height - 12;
      newX = Math.max(12, Math.min(newX, maxX));
      newY = Math.max(12, Math.min(newY, maxY));
      setDragPos({ x: newX, y: newY });
    }
  }, [containerRef]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  }, [handleTouchMove]);

  const handleTouchStart = useCallback((e) => {
    isDragging.current = true;
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX, y: touch.clientY };
    elementStart.current = { x: dragPos.x, y: dragPos.y };
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [dragPos.x, dragPos.y, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    if (localVideoStream) {
      setDragPos({ x: 318, y: 12 });
    }
  }, [localVideoStream]);

  useEffect(() => {
    if (dragRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elementRect = dragRef.current.getBoundingClientRect();
      const maxX = containerRect.width - elementRect.width - 12;
      const maxY = containerRect.height - elementRect.height - 12;
      setDragPos((prev) => {
        const newX = Math.max(12, Math.min(prev.x, maxX));
        const newY = Math.max(12, Math.min(prev.y, maxY));
        if (newX !== prev.x || newY !== prev.y) return { x: newX, y: newY };
        return prev;
      });
    }
  }, [cardSize, localVideoStream, containerRef]);

  return {
    dragPos,
    dragRef,
    handleMouseDown,
    handleTouchStart
  };
}
