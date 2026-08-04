import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { dataService } from '../../services/dataLayer';
import { startAudioAnalyzer } from './audioAnalyzer';
import { createPeerConnection } from './iceServers';
import { isScreenTrack, attachRemoteAudioElement } from './mediaTrackHelpers';

/**
 * Owns the connected-call WebRTC media channel (1:1 + group mesh).
 * Pure extract from CallProvider — same effect body and deps.
 */
export function useCallWebRtc({
  callStatus,
  endCallLocally,
  callStateRef,
  callChatRef,
  currentUserRef,
  localStreamRef,
  localVideoStreamRef,
  pcRef,
  pcsRef,
  candidateQueuesRef,
  audioAnalyzersRef,
  activeCallChannelRef,
  screenStreamRef,
  wasCameraActiveRef,
  setCallState,
  setGroupCallParticipants,
  setLocalVideoStream,
  setRemoteVideoStream,
  setIsScreenSharing
}) {
  useEffect(() => {
    let activeCallChannel = null;
    let localStream = null;
    let pc = null;
    const candidateQueue = [];

    const processCandidateQueue = async () => {
      if (!pc) return;
      console.log(`Processing ICE candidate queue (${candidateQueue.length} items)...`);
      while (candidateQueue.length > 0) {
        const candidate = candidateQueue.shift();
        try {
          await pc.addIceCandidate(candidate);
          console.log("Successfully added queued ICE candidate:", candidate.candidate);
        } catch (e) {
          console.error("Error adding queued ICE candidate:", e);
        }
      }
    };

    const initWebRTC = async () => {
      if (callStateRef.current.status !== 'connected') return;

      console.log("Initializing WebRTC call...");

      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = localStream;
        console.log("Local audio stream captured successfully.");

        if (audioAnalyzersRef.current['local']) {
          audioAnalyzersRef.current['local'].stop();
        }
        const localAnalyzer = startAudioAnalyzer(localStream, (isSpeaking) => {
          setCallState(prev => {
            if (prev.isLocalSpeaking !== isSpeaking) {
              return { ...prev, isLocalSpeaking: isSpeaking };
            }
            return prev;
          });
          setGroupCallParticipants(prev => prev.map(p => {
            const isMe = p.id === (currentUserRef.current?.id || 'current');
            if (isMe) {
              return { ...p, speaking: isSpeaking };
            }
            return p;
          }));
        });
        audioAnalyzersRef.current['local'] = localAnalyzer;
      } catch (err) {
        console.error("Failed to capture local audio:", err);
        alert("Не удалось получить доступ к микрофону!");
        endCallLocally();
        return;
      }

      pc = createPeerConnection();
      pcRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        console.log("WebRTC ICE Connection State Changed:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setCallState(prev => ({ ...prev, webrtcState: 'connected' }));
        } else if (pc.iceConnectionState === 'failed') {
          setCallState(prev => ({ ...prev, webrtcState: 'failed' }));
          console.error("WebRTC ICE connection failed.");
        } else if (pc.iceConnectionState === 'checking') {
          setCallState(prev => ({ ...prev, webrtcState: 'connecting' }));
        } else if (pc.iceConnectionState === 'disconnected') {
          setCallState(prev => ({ ...prev, webrtcState: 'connecting' }));
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && activeCallChannel) {
          activeCallChannel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'candidate', candidate: event.candidate }
          });
        }
      };

      pc.ontrack = (event) => {
        console.log("Remote WebRTC track received:", event.track.kind);
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        
        if (event.track.kind === 'audio') {
          const elementId = `webrtc-audio-${remoteStream.id}`;
          attachRemoteAudioElement(elementId, remoteStream);

          if (audioAnalyzersRef.current['remote']) {
            audioAnalyzersRef.current['remote'].stop();
          }
          const remoteAnalyzer = startAudioAnalyzer(remoteStream, (isSpeaking) => {
            setCallState(prev => {
              if (prev.isRemoteSpeaking !== isSpeaking) {
                return { ...prev, isRemoteSpeaking: isSpeaking };
              }
              return prev;
            });
          });
          audioAnalyzersRef.current['remote'] = remoteAnalyzer;
        } else if (event.track.kind === 'video') {
          setRemoteVideoStream(remoteStream);
          const isScreen = isScreenTrack(event.track);
          setCallState(prev => ({ ...prev, isRemoteScreenSharing: isScreen }));
        }
      };

      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      if (dataService.isLive()) {
        const isGroup = callChatRef.current?.type === 'group';

        if (isGroup) {
          activeCallChannel = supabase.channel(`call:chat:${callStateRef.current.chatId}:media`, {
            config: {
              private: true,
              presence: { key: currentUserRef.current.id }
            }
          });
          activeCallChannelRef.current = activeCallChannel;

          const processPeerCandidateQueue = async (peerId, pcInstance) => {
            const queue = candidateQueuesRef.current[peerId];
            if (!queue || queue.length === 0) return;
            while (queue.length > 0) {
              const candidate = queue.shift();
              try {
                await pcInstance.addIceCandidate(candidate);
              } catch (e) {
                console.error(`Error adding queued ICE candidate for peer ${peerId}:`, e);
              }
            }
          };

          const ensureGroupParticipant = (peerId) => {
            const memberInfo = callChatRef.current?.members?.find(member => member.id === peerId);
            setGroupCallParticipants(previous => {
              if (previous.some(participant => participant.id === peerId)) {
                return previous.map(participant => (
                  participant.id === peerId ? { ...participant, isReal: true } : participant
                ));
              }
              return [...previous, {
                id: peerId,
                name: memberInfo ? memberInfo.name : `Пользователь ${peerId.slice(0, 4)}`,
                avatar: memberInfo ? memberInfo.avatar : '👤',
                avatarColor: (memberInfo && (memberInfo.avatarColor || memberInfo.avatar_color))
                  || 'linear-gradient(135deg, #a1c4fd, #c2e9fb)',
                muted: false,
                videoStream: null,
                speaking: false,
                isReal: true
              }];
            });
          };
          const getOrCreatePeerConnection = (peerId) => {
            if (pcsRef.current[peerId]) {
              return pcsRef.current[peerId];
            }
            const pcInstance = createPeerConnection();

            pcInstance.oniceconnectionstatechange = () => {
              if (pcInstance.iceConnectionState === 'connected' || pcInstance.iceConnectionState === 'completed') {
                setCallState(prev => ({ ...prev, webrtcState: 'connected' }));
              }
            };

            pcInstance.onicecandidate = (event) => {
              if (event.candidate && activeCallChannel) {
                activeCallChannel.send({
                  type: 'broadcast',
                  event: 'signal',
                  payload: {
                    type: 'candidate',
                    candidate: event.candidate,
                    senderId: currentUserRef.current.id,
                    targetId: peerId
                  }
                });
              }
            };

            pcInstance.ontrack = (event) => {
              const remoteStream = event.streams[0] || new MediaStream([event.track]);
              
              if (event.track.kind === 'audio') {
                const elementId = `webrtc-audio-${peerId}-${remoteStream.id}`;
                attachRemoteAudioElement(elementId, remoteStream);

                if (audioAnalyzersRef.current[peerId]) {
                  audioAnalyzersRef.current[peerId].stop();
                }
                const analyzer = startAudioAnalyzer(remoteStream, (isSpeaking) => {
                  setGroupCallParticipants(prev => prev.map(p => {
                    if (p.id === peerId) {
                      return { ...p, speaking: isSpeaking };
                    }
                    return p;
                  }));
                });
                audioAnalyzersRef.current[peerId] = analyzer;
              } else if (event.track.kind === 'video') {
                setRemoteVideoStream(remoteStream);
                const isScreen = isScreenTrack(event.track);
                setCallState(prev => ({ ...prev, isRemoteScreenSharing: isScreen }));
              }
            };

            if (localStream) {
              localStream.getTracks().forEach(track => {
                pcInstance.addTrack(track, localStream);
              });
            }
            const activeVideoStream = localVideoStreamRef.current;
            if (activeVideoStream) {
              activeVideoStream.getVideoTracks()
                .filter(track => track.readyState === 'live')
                .forEach(track => pcInstance.addTrack(track, activeVideoStream));
            }

            pcsRef.current[peerId] = pcInstance;
            return pcInstance;
          };

          activeCallChannel
            .on('presence', { event: 'sync' }, () => {
              const presenceState = activeCallChannel.presenceState();
              const syncedParticipants = new Map();

              Object.values(presenceState).flat().forEach(presence => {
                if (!presence?.id) return;
                const memberInfo = callChatRef.current?.members?.find(member => member.id === presence.id);
                syncedParticipants.set(presence.id, {
                  id: presence.id,
                  name: presence.id === currentUserRef.current.id
                    ? 'Вы'
                    : presence.name || memberInfo?.name || `Пользователь ${presence.id.slice(0, 4)}`,
                  avatar: presence.avatar || memberInfo?.avatar || '👤',
                  avatarColor: presence.avatarColor
                    || memberInfo?.avatarColor
                    || memberInfo?.avatar_color
                    || 'linear-gradient(135deg, #a1c4fd, #c2e9fb)',
                  muted: Boolean(presence.muted),
                  videoStream: null,
                  speaking: false,
                  isReal: true
                });
              });

              setGroupCallParticipants(previous => (
                [...syncedParticipants.values()]
                  .map(participant => {
                    const existing = previous.find(item => item.id === participant.id);
                    return existing
                      ? { ...participant, speaking: existing.speaking, videoStream: existing.videoStream }
                      : participant;
                  })
                  .sort((left, right) => Number(right.id === currentUserRef.current.id) - Number(left.id === currentUserRef.current.id))
              ));
            })
            .on('broadcast', { event: 'join-group-call' }, async (payload) => {
              const { senderId } = payload.payload;
              if (senderId === currentUserRef.current.id) return;

              ensureGroupParticipant(senderId);
              
              if (pcsRef.current[senderId]) {
                const existingPc = pcsRef.current[senderId];
                if (existingPc.connectionState === 'connected' || existingPc.iceConnectionState === 'connected') {
                  return;
                }
              }
              
              const pcInstance = getOrCreatePeerConnection(senderId);
              try {
                const offer = await pcInstance.createOffer();
                await pcInstance.setLocalDescription(offer);
                activeCallChannel.send({
                  type: 'broadcast',
                  event: 'signal',
                  payload: {
                    type: 'offer',
                    sdp: offer.sdp,
                    senderId: currentUserRef.current.id,
                    targetId: senderId
                  }
                });
              } catch (err) {
                console.error(`Error generating offer for peer ${senderId}:`, err);
              }
            })
            .on('broadcast', { event: 'signal' }, async (payload) => {
              const signal = payload.payload;
              if (signal.targetId !== currentUserRef.current.id) return;
              const senderId = signal.senderId;
              if (!senderId) return;
              ensureGroupParticipant(senderId);

              const pcInstance = getOrCreatePeerConnection(senderId);

              if (signal.type === 'offer') {
                try {
                  await pcInstance.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
                  const answer = await pcInstance.createAnswer();
                  await pcInstance.setLocalDescription(answer);
                  activeCallChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: {
                      type: 'answer',
                      sdp: answer.sdp,
                      senderId: currentUserRef.current.id,
                      targetId: senderId
                    }
                  });
                  await processPeerCandidateQueue(senderId, pcInstance);
                } catch (e) {
                  console.error(`Error handshaking offer from peer ${senderId}:`, e);
                }
              } else if (signal.type === 'answer') {
                try {
                  await pcInstance.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
                  await processPeerCandidateQueue(senderId, pcInstance);
                } catch (e) {
                  console.error(`Error setting answer from peer ${senderId}:`, e);
                }
              } else if (signal.type === 'candidate') {
                try {
                  const iceCandidate = new RTCIceCandidate(signal.candidate);
                  if (pcInstance.remoteDescription && pcInstance.remoteDescription.type) {
                    await pcInstance.addIceCandidate(iceCandidate);
                  } else {
                    candidateQueuesRef.current[senderId] = candidateQueuesRef.current[senderId] || [];
                    candidateQueuesRef.current[senderId].push(iceCandidate);
                  }
                } catch (e) {
                  console.error(`Error adding ICE candidate from peer ${senderId}:`, e);
                }
              }
            })
            .on('broadcast', { event: 'hangup' }, (payload) => {
              const { senderId } = payload.payload || {};
              if (senderId) {
                if (pcsRef.current[senderId]) {
                  pcsRef.current[senderId].close();
                  delete pcsRef.current[senderId];
                }
                delete candidateQueuesRef.current[senderId];
                document.querySelectorAll(`[id^="webrtc-audio-${senderId}-"]`).forEach(el => {
                  el.srcObject = null;
                  el.remove();
                });
                setGroupCallParticipants(prev => prev.filter(p => p.id !== senderId));
              }
            })
            .subscribe(async (status) => {
              if (status === 'SUBSCRIBED') {
                await activeCallChannel.track({
                  id: currentUserRef.current.id,
                  name: currentUserRef.current.name || currentUserRef.current.username || 'Пользователь',
                  avatar: currentUserRef.current.avatar || '🪙',
                  avatarColor: currentUserRef.current.avatarColor || currentUserRef.current.avatar_color,
                  muted: callStateRef.current.muted
                });
                await activeCallChannel.send({
                  type: 'broadcast',
                  event: 'join-group-call',
                  payload: { senderId: currentUserRef.current.id }
                });
              }
            });
        } else {
          activeCallChannel = supabase.channel(`call:chat:${callStateRef.current.chatId}:media`, { config: { private: true } });
          activeCallChannelRef.current = activeCallChannel;

          const sendOffer = async () => {
            if (pc.remoteDescription) return;
            if (pc.localDescription) {
              if (activeCallChannel) {
                activeCallChannel.send({
                  type: 'broadcast',
                  event: 'signal',
                  payload: { type: 'offer', sdp: pc.localDescription.sdp }
                });
              }
              return;
            }
            if (pc.signalingState !== 'stable') return;
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              activeCallChannel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'offer', sdp: offer.sdp }
              });
            } catch (err) {
              console.error("Error generating offer:", err);
            }
          };

          activeCallChannel
            .on('broadcast', { event: 'signal' }, async (payload) => {
              const signal = payload.payload;
              const isInitialSignal = ['ready', 'offer', 'answer'].includes(signal.type);
              if (isInitialSignal && pc && (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected')) {
                return;
              }

              if (signal.type === 'ready' && callStateRef.current.isOutgoing) {
                await sendOffer();
              } else if (signal.type === 'offer' && !callStateRef.current.isOutgoing) {
                try {
                  if (pc && pc.remoteDescription) return;
                  if (pc && pc.signalingState !== 'stable') return;
                  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);
                  activeCallChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'answer', sdp: answer.sdp }
                  });
                  await processCandidateQueue();
                } catch (e) {
                  console.error("Error setting offer/creating answer:", e);
                }
              } else if (signal.type === 'answer' && callStateRef.current.isOutgoing) {
                try {
                  if (pc && pc.remoteDescription) return;
                  if (pc && pc.signalingState !== 'have-local-offer') return;
                  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
                  await processCandidateQueue();
                } catch (e) {
                  console.error("Error setting remote answer:", e);
                }
              } else if (signal.type === 'renegotiate-offer') {
                try {
                  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);
                  activeCallChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'renegotiate-answer', sdp: answer.sdp }
                  });
                  await processCandidateQueue();
                } catch (e) {
                  console.error("Error renegotiating offer:", e);
                }
              } else if (signal.type === 'renegotiate-answer') {
                try {
                  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
                  await processCandidateQueue();
                } catch (e) {
                  console.error("Error setting renegotiation answer:", e);
                }
              } else if (signal.type === 'video-stopped') {
                setRemoteVideoStream(null);
              } else if (signal.type === 'candidate') {
                try {
                  const iceCandidate = new RTCIceCandidate(signal.candidate);
                  if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                    await pc.addIceCandidate(iceCandidate);
                  } else {
                    candidateQueue.push(iceCandidate);
                  }
                } catch (e) {
                  console.error("Error adding ice candidate:", e);
                }
              }
            })
            .on('broadcast', { event: 'hangup' }, () => {
              endCallLocally();
            })
            .subscribe(async (status) => {
              if (status === 'SUBSCRIBED') {
                if (callStateRef.current.isOutgoing) {
                  await sendOffer();
                } else {
                  activeCallChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'ready' }
                  });
                }
              }
            });
        }
      }
    };

    initWebRTC();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach(track => track.stop());
        localVideoStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      candidateQueuesRef.current = {};
      wasCameraActiveRef.current = false;
      setLocalVideoStream(null);
      setRemoteVideoStream(null);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (activeCallChannelRef.current) {
        activeCallChannelRef.current.unsubscribe();
        activeCallChannelRef.current = null;
      }
      document.querySelectorAll('.webrtc-remote-audio-feed').forEach(el => {
        el.srcObject = null;
        el.remove();
      });
    };
  // Refs/setters are stable; only re-run when call enters/leaves connected status.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional connected-call lifecycle
  }, [callStatus, endCallLocally]);

}


