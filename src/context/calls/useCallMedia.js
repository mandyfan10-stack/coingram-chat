import { useCallback } from 'react';
import { removeVideoSender, replaceOrAddVideoTrack, stopStreamTracks } from './mediaTrackHelpers';

/**
 * Camera / screen-share controls and renegotiation for 1:1 and group calls.
 */
export function useCallMedia({
  callState,
  chats,
  currentUser,
  localVideoStream,
  setLocalVideoStream,
  isScreenSharing,
  setIsScreenSharing,
  localVideoStreamRef,
  screenStreamRef,
  wasCameraActiveRef,
  pcRef,
  pcsRef,
  activeCallChannelRef
}) {
  const triggerRenegotiation = useCallback(async () => {
    const isGroup = chats.find((c) => c.id === callState.chatId)?.type === 'group';
    if (isGroup) {
      await Promise.all(Object.keys(pcsRef.current).map(async (peerId) => {
        const pcInstance = pcsRef.current[peerId];
        if (pcInstance && activeCallChannelRef.current) {
          try {
            const offer = await pcInstance.createOffer();
            await pcInstance.setLocalDescription(offer);
            await activeCallChannelRef.current.send({
              type: 'broadcast',
              event: 'signal',
              payload: {
                type: 'offer',
                sdp: offer.sdp,
                senderId: currentUser.id,
                targetId: peerId
              }
            });
          } catch (e) {
            console.error(e);
          }
        }
      }));
    } else if (pcRef.current && activeCallChannelRef.current) {
      try {
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        activeCallChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'renegotiate-offer', sdp: offer.sdp }
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, [callState.chatId, chats, currentUser, pcsRef, pcRef, activeCallChannelRef]);

  const cleanupVideoTracks = useCallback(async () => {
    if (localVideoStreamRef.current) {
      localVideoStreamRef.current.getTracks().forEach((track) => track.stop());
      localVideoStreamRef.current = null;
    }
    setLocalVideoStream(null);

    const isGroup = chats.find((c) => c.id === callState.chatId)?.type === 'group';
    if (isGroup) {
      Object.keys(pcsRef.current).forEach((peerId) => {
        const pcInstance = pcsRef.current[peerId];
        if (pcInstance) removeVideoSender(pcInstance);
      });
    } else if (pcRef.current) {
      removeVideoSender(pcRef.current);
    }

    if (activeCallChannelRef.current) {
      activeCallChannelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { type: 'video-stopped' }
      });
      await triggerRenegotiation();
    }
  }, [callState.chatId, chats, triggerRenegotiation, localVideoStreamRef, setLocalVideoStream, pcsRef, pcRef, activeCallChannelRef]);

  const stopScreenSharing = useCallback(async (revertToCamera = false) => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    if (revertToCamera && wasCameraActiveRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        setLocalVideoStream(stream);
        localVideoStreamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        const isGroup = chats.find((c) => c.id === callState.chatId)?.type === 'group';

        if (isGroup) {
          await Promise.all(Object.keys(pcsRef.current).map(async (peerId) => {
            if (pcsRef.current[peerId]) await replaceOrAddVideoTrack(pcsRef.current[peerId], videoTrack, stream);
          }));
          await triggerRenegotiation();
        } else if (pcRef.current) {
          await replaceOrAddVideoTrack(pcRef.current, videoTrack, stream);
          await triggerRenegotiation();
        }
      } catch (err) {
        console.error(err);
        await cleanupVideoTracks();
      }
    } else {
      await cleanupVideoTracks();
    }
    wasCameraActiveRef.current = false;
  }, [cleanupVideoTracks, triggerRenegotiation, callState.chatId, chats, screenStreamRef, wasCameraActiveRef, setIsScreenSharing, setLocalVideoStream, localVideoStreamRef, pcsRef, pcRef]);

  const toggleCallVideo = useCallback(async () => {
    if (callState.status !== 'connected') return;

    const isGroup = chats.find((c) => c.id === callState.chatId)?.type === 'group';

    if (localVideoStream) {
      localVideoStream.getTracks().forEach((track) => track.stop());
      localVideoStreamRef.current = null;
      if (screenStreamRef.current) {
        stopStreamTracks(screenStreamRef.current);
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      wasCameraActiveRef.current = false;

      if (isGroup) {
        Object.keys(pcsRef.current).forEach((peerId) => {
          if (pcsRef.current[peerId]) removeVideoSender(pcsRef.current[peerId]);
        });
      } else if (pcRef.current) {
        removeVideoSender(pcRef.current);
      }

      setLocalVideoStream(null);

      if (activeCallChannelRef.current) {
        activeCallChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'video-stopped' }
        });
        await triggerRenegotiation();
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        setLocalVideoStream(stream);
        localVideoStreamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];

        if (isGroup) {
          Object.keys(pcsRef.current).forEach((peerId) => {
            if (pcsRef.current[peerId]) pcsRef.current[peerId].addTrack(videoTrack, stream);
          });
          await triggerRenegotiation();
        } else if (pcRef.current) {
          pcRef.current.addTrack(videoTrack, stream);
          await triggerRenegotiation();
        }
      } catch (err) {
        console.error('Failed to capture video:', err);
        alert('Не удалось получить доступ к камере!');
      }
    }
  }, [callState.status, localVideoStream, callState.chatId, chats, triggerRenegotiation, localVideoStreamRef, screenStreamRef, wasCameraActiveRef, setIsScreenSharing, setLocalVideoStream, pcsRef, pcRef, activeCallChannelRef]);

  const toggleCallScreenShare = useCallback(async () => {
    if (callState.status !== 'connected') return;

    if (isScreenSharing) {
      await stopScreenSharing(true);
    } else {
      try {
        const wasCameraActive = !!localVideoStream;
        wasCameraActiveRef.current = wasCameraActive;

        if (wasCameraActive) {
          if (localVideoStreamRef.current) {
            localVideoStreamRef.current.getTracks().forEach((track) => track.stop());
            localVideoStreamRef.current = null;
          }
          setLocalVideoStream(null);
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        setLocalVideoStream(screenStream);
        localVideoStreamRef.current = screenStream;

        const screenTrack = screenStream.getVideoTracks()[0];

        screenTrack.onended = () => {
          stopScreenSharing(true);
        };

        const isGroup = chats.find((c) => c.id === callState.chatId)?.type === 'group';

        if (isGroup) {
          await Promise.all(Object.keys(pcsRef.current).map(async (peerId) => {
            if (pcsRef.current[peerId]) await replaceOrAddVideoTrack(pcsRef.current[peerId], screenTrack, screenStream);
          }));
          await triggerRenegotiation();
        } else if (pcRef.current) {
          await replaceOrAddVideoTrack(pcRef.current, screenTrack, screenStream);
        }
      } catch (err) {
        console.error('Failed screen share:', err);
        if (wasCameraActiveRef.current) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            setLocalVideoStream(stream);
            localVideoStreamRef.current = stream;

            const videoTrack = stream.getVideoTracks()[0];
            const isGroup = chats.find((c) => c.id === callState.chatId)?.type === 'group';

            if (isGroup) {
              await Promise.all(Object.keys(pcsRef.current).map(async (peerId) => {
                if (pcsRef.current[peerId]) await replaceOrAddVideoTrack(pcsRef.current[peerId], videoTrack, stream);
              }));
              await triggerRenegotiation();
            } else if (pcRef.current) {
              await replaceOrAddVideoTrack(pcRef.current, videoTrack, stream);
              await triggerRenegotiation();
            }
          } catch (cameraErr) {
            console.error(cameraErr);
          }
        }
        wasCameraActiveRef.current = false;
      }
    }
  }, [callState.status, isScreenSharing, localVideoStream, stopScreenSharing, triggerRenegotiation, callState.chatId, chats, wasCameraActiveRef, localVideoStreamRef, screenStreamRef, setIsScreenSharing, setLocalVideoStream, pcsRef, pcRef]);

  return {
    triggerRenegotiation,
    cleanupVideoTracks,
    stopScreenSharing,
    toggleCallVideo,
    toggleCallScreenShare
  };
}
