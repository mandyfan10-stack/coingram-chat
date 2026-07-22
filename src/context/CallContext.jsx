import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';
import { supabase } from '../supabaseClient';
import { dataService } from '../services/dataLayer';

const CallContext = createContext();

const startAudioAnalyzer = (stream, onVolume) => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    const audioCtx = new AudioContextClass();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let isStopped = false;
    const checkVolume = () => {
      if (isStopped) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const isSpeaking = average > 15;
      onVolume(isSpeaking);
      
      setTimeout(() => {
        if (!isStopped) requestAnimationFrame(checkVolume);
      }, 50);
    };
    checkVolume();
    
    return {
      stop: () => {
        isStopped = true;
        try {
          source.disconnect();
          analyser.disconnect();
          audioCtx.close();
        } catch (e) {}
      }
    };
  } catch (e) {
    console.warn("Failed to create audio analyzer:", e);
    return null;
  }
};

export const CallProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { chats, activeChatId } = useChat();

  const [callState, setCallState] = useState({
    status: 'idle',
    chatId: null,
    duration: 0,
    muted: false,
    isOutgoing: false,
    callerInfo: null,
    otherUserId: null,
    webrtcState: 'disconnected',
    isRemoteScreenSharing: false,
    isLocalSpeaking: false,
    isRemoteSpeaking: false
  });

  const [groupCallParticipants, setGroupCallParticipants] = useState([]);
  const groupCallTimersRef = useRef([]);
  const pcsRef = useRef({});
  const candidateQueuesRef = useRef({});
  const audioAnalyzersRef = useRef({});

  const [localVideoStream, setLocalVideoStream] = useState(null);
  const [remoteVideoStream, setRemoteVideoStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef(null);
  const wasCameraActiveRef = useRef(false);

  const localStreamRef = useRef(null);
  const localVideoStreamRef = useRef(null);
  const pcRef = useRef(null);
  const globalSignalingChannelRef = useRef(null);
  const activeCallChannelRef = useRef(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const currentUserRef = useRef(currentUser);
  const activeChatRef = useRef(activeChat);
  const callStateRef = useRef(callState);
  currentUserRef.current = currentUser;
  activeChatRef.current = activeChat;
  callStateRef.current = callState;

  const endCallLocally = useCallback(() => {
    setCallState(prev => ({
      ...prev,
      status: 'ended'
    }));
    if (groupCallTimersRef.current) {
      groupCallTimersRef.current.forEach(t => {
        clearTimeout(t);
        clearInterval(t);
      });
      groupCallTimersRef.current = [];
    }
    setGroupCallParticipants([]);

    // Close and clear group peer connections
    Object.keys(pcsRef.current).forEach(peerId => {
      if (pcsRef.current[peerId]) {
        pcsRef.current[peerId].close();
      }
    });
    pcsRef.current = {};

    // Stop and clear all audio analyzers
    Object.keys(audioAnalyzersRef.current).forEach(key => {
      if (audioAnalyzersRef.current[key]) {
        audioAnalyzersRef.current[key].stop();
      }
    });
    audioAnalyzersRef.current = {};

    setTimeout(() => {
      setCallState({
        status: 'idle',
        chatId: null,
        duration: 0,
        muted: false,
        isOutgoing: false,
        callerInfo: null,
        otherUserId: null,
        webrtcState: 'disconnected',
        isRemoteScreenSharing: false,
        isLocalSpeaking: false,
        isRemoteSpeaking: false
      });
    }, 1500);
  }, []);

  // Global Call Signaling Listener
  useEffect(() => {
    if (!dataService.isLive() || !currentUser) {
      if (globalSignalingChannelRef.current) {
        globalSignalingChannelRef.current.unsubscribe();
        globalSignalingChannelRef.current = null;
      }
      return;
    }

    const signalingChannel = supabase.channel(`call-signals-${currentUser.id}`);
    globalSignalingChannelRef.current = signalingChannel;

    signalingChannel
      .on('broadcast', { event: 'incoming-call' }, (payload) => {
        const { callerId, callerName, callerAvatar, callerAvatarColor, chatId } = payload.payload;
        setCallState({
          status: 'incoming',
          chatId,
          duration: 0,
          muted: false,
          isOutgoing: false,
          callerInfo: { name: callerName, avatar: callerAvatar, avatarColor: callerAvatarColor },
          otherUserId: callerId,
          webrtcState: 'disconnected'
        });
      })
      .on('broadcast', { event: 'call-accepted' }, (payload) => {
        const { responderId } = payload.payload || {};
        setCallState(prev => {
          if (prev.status === 'calling') {
            return { 
              ...prev, 
              status: 'connected', 
              otherUserId: responderId || prev.otherUserId 
            };
          }
          return prev;
        });
      })
      .on('broadcast', { event: 'call-rejected' }, () => {
        setCallState(prev => {
          if (prev.status === 'calling' || prev.status === 'connected') {
            return { ...prev, status: 'ended' };
          }
          return prev;
        });
        setTimeout(() => {
          setCallState({ status: 'idle', chatId: null, duration: 0, muted: false, isOutgoing: false, callerInfo: null, otherUserId: null, webrtcState: 'disconnected' });
        }, 1500);
      })
      .subscribe();

    return () => {
      if (globalSignalingChannelRef.current) {
        globalSignalingChannelRef.current.unsubscribe();
        globalSignalingChannelRef.current = null;
      }
    };
  }, [currentUser]);

  // WebRTC Connection and Streaming Effect
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

      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'], username: 'openrelay', credential: 'openrelay' }
        ]
      });
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
          let audioEl = document.getElementById(elementId);
          if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = elementId;
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            audioEl.className = 'webrtc-remote-audio-feed';
            document.body.appendChild(audioEl);
          }
          audioEl.srcObject = remoteStream;
          audioEl.play().catch(e => {
            console.warn("Audio element autoplay failed, manual triggering:", e);
          });

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
          const label = event.track.label ? event.track.label.toLowerCase() : '';
          const isScreen = label.includes('screen') || label.includes('window') || label.includes('display') || label.includes('desktop');
          setCallState(prev => ({ ...prev, isRemoteScreenSharing: isScreen }));
        }
      };

      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      if (dataService.isLive()) {
        const isGroup = activeChatRef.current?.type === 'group';

        if (isGroup) {
          activeCallChannel = supabase.channel(`call-signals-webrtc-${callStateRef.current.chatId}`);
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

          const getOrCreatePeerConnection = (peerId) => {
            if (pcsRef.current[peerId]) {
              return pcsRef.current[peerId];
            }
            const pcInstance = new RTCPeerConnection({
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'], username: 'openrelay', credential: 'openrelay' }
              ]
            });

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
                let audioEl = document.getElementById(elementId);
                if (!audioEl) {
                  audioEl = document.createElement('audio');
                  audioEl.id = elementId;
                  audioEl.autoplay = true;
                  audioEl.playsInline = true;
                  audioEl.className = 'webrtc-remote-audio-feed';
                  document.body.appendChild(audioEl);
                }
                audioEl.srcObject = remoteStream;
                audioEl.play().catch(e => {
                  console.warn("Audio element autoplay failed:", e);
                });

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
                const label = event.track.label ? event.track.label.toLowerCase() : '';
                const isScreen = label.includes('screen') || label.includes('window') || label.includes('display') || label.includes('desktop');
                setCallState(prev => ({ ...prev, isRemoteScreenSharing: isScreen }));
              }
            };

            if (localStream) {
              localStream.getTracks().forEach(track => {
                pcInstance.addTrack(track, localStream);
              });
            }

            pcsRef.current[peerId] = pcInstance;
            return pcInstance;
          };

          activeCallChannel
            .on('broadcast', { event: 'join-group-call' }, async (payload) => {
              const { senderId } = payload.payload;
              if (senderId === currentUserRef.current.id) return;

              const memberInfo = activeChatRef.current?.members?.find(m => m.id === senderId);
              setGroupCallParticipants(prev => {
                if (prev.some(p => p.id === senderId)) {
                  return prev.map(p => p.id === senderId ? { ...p, isReal: true } : p);
                }
                return [...prev, {
                  id: senderId,
                  name: memberInfo ? memberInfo.name : `Пользователь ${senderId.slice(0, 4)}`,
                  avatar: memberInfo ? memberInfo.avatar : '👤',
                  avatarColor: (memberInfo && (memberInfo.avatarColor || memberInfo.avatar_color)) || 'linear-gradient(135deg, #a1c4fd, #c2e9fb)',
                  muted: false,
                  videoStream: null,
                  speaking: false,
                  isReal: true
                }];
              });
              
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
                activeCallChannel.send({
                  type: 'broadcast',
                  event: 'join-group-call',
                  payload: { senderId: currentUserRef.current.id }
                });
              }
            });
        } else {
          activeCallChannel = supabase.channel(`call-signals-webrtc-${callStateRef.current.chatId}`);
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
  }, [callState.status, endCallLocally]);

  const sendSignalingMessage = useCallback((targetUserId, event, payload) => {
    if (!dataService.isLive()) return;
    const channelName = `call-signals-${targetUserId}`;
    const channel = supabase.channel(channelName);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event,
          payload
        }).then(() => {
          setTimeout(() => {
            channel.unsubscribe();
          }, 3000);
        }).catch(err => {
          console.error(err);
          channel.unsubscribe();
        });
      }
    });
  }, []);

  const startCall = useCallback((chatId) => {
    if (!currentUser) return;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    const otherMember = chat.members.find(m => m.id !== currentUser.id && m.id !== 'current');
    const otherUserId = chat.type === 'personal' ? (otherMember ? otherMember.id : null) : null;
    const isGroup = chat.type === 'group';

    setCallState({
      status: isGroup ? 'connected' : 'calling',
      chatId,
      duration: 0,
      muted: false,
      isOutgoing: true,
      otherUserId,
      callerInfo: null,
      webrtcState: isGroup ? 'connected' : 'disconnected'
    });

    if (isGroup) {
      setGroupCallParticipants([
        {
          id: currentUser.id || 'current',
          name: 'Вы',
          avatar: currentUser.avatar || '🪙',
          avatarColor: currentUser.avatarColor,
          muted: false,
          videoStream: null,
          speaking: false
        }
      ]);

      if (!dataService.isLive()) {
        const timers = [];
        const speakInterval = setInterval(() => {
          setGroupCallParticipants(prev => {
            return prev.map(p => {
              const isMe = p.id === (currentUser?.id || 'current');
              if (isMe) {
                return { ...p, speaking: !p.muted && Math.random() > 0.65 };
              }
              if (p.isReal) return p;
              return !p.muted ? { ...p, speaking: Math.random() > 0.65 } : { ...p, speaking: false };
            });
          });
        }, 1500);
        timers.push(speakInterval);
        groupCallTimersRef.current = timers;
      }
    }

    if (dataService.isLive()) {
      if (chat.type === 'personal' && otherUserId) {
        sendSignalingMessage(otherUserId, 'incoming-call', {
          callerId: currentUser.id,
          callerName: currentUser.name || currentUser.username || 'Пользователь',
          callerAvatar: currentUser.avatar,
          callerAvatarColor: currentUser.avatarColor,
          chatId
        });
      } else if (isGroup) {
        chat.members.forEach(member => {
          const targetId = member.id === 'current' ? currentUser.id : member.id;
          if (targetId && targetId !== currentUser.id) {
            sendSignalingMessage(targetId, 'incoming-call', {
              callerId: currentUser.id,
              callerName: chat.name || 'Группа',
              callerAvatar: chat.avatar,
              callerAvatarColor: chat.avatarColor || chat.avatar_color,
              chatId
            });
          }
        });
      }
    } else if (!isGroup) {
      setTimeout(() => {
        setCallState(prev => {
          if (prev.status === 'calling') {
            return { ...prev, status: 'connected', webrtcState: 'connected' };
          }
          return prev;
        });
      }, 3000);
    }
  }, [currentUser, chats, sendSignalingMessage]);

  const acceptCall = useCallback(() => {
    const chat = chats.find(c => c.id === callState.chatId);
    const isGroup = chat && chat.type === 'group';

    if (isGroup) {
      setGroupCallParticipants([
        {
          id: currentUser.id || 'current',
          name: 'Вы',
          avatar: currentUser.avatar || '🪙',
          avatarColor: currentUser.avatarColor,
          muted: false,
          videoStream: null,
          speaking: false
        }
      ]);
    }

    if (dataService.isLive() && callState.otherUserId) {
      sendSignalingMessage(callState.otherUserId, 'call-accepted', { responderId: currentUser.id });
    }
    setCallState(prev => ({
      ...prev,
      status: 'connected',
      webrtcState: dataService.isLive() ? 'connecting' : 'connected'
    }));

    if (!dataService.isLive()) {
      setTimeout(() => {
        setCallState(prev => prev.status === 'connected' ? { ...prev, webrtcState: 'connected' } : prev);
      }, 1500);
    }
  }, [callState.chatId, callState.otherUserId, currentUser, chats, sendSignalingMessage]);

  const rejectCall = useCallback(() => {
    if (dataService.isLive() && callState.otherUserId) {
      sendSignalingMessage(callState.otherUserId, 'call-rejected', {});
    }
    endCallLocally();
  }, [callState.otherUserId, endCallLocally, sendSignalingMessage]);

  const endCall = useCallback(() => {
    if (dataService.isLive()) {
      if (activeCallChannelRef.current) {
        activeCallChannelRef.current.send({
          type: 'broadcast',
          event: 'hangup',
          payload: { senderId: currentUser?.id }
        });
      } else if (callState.otherUserId) {
        sendSignalingMessage(callState.otherUserId, 'call-rejected', {});
      }
    }
    endCallLocally();
  }, [callState.otherUserId, endCallLocally, currentUser, sendSignalingMessage]);

  const toggleCallMute = useCallback(() => {
    const nextMuted = !callState.muted;
    setCallState(prev => ({ ...prev, muted: nextMuted }));

    setGroupCallParticipants(prev => prev.map(p => {
      const isMe = p.id === (currentUser?.id || 'current');
      return isMe ? { ...p, muted: nextMuted, speaking: nextMuted ? false : p.speaking } : p;
    }));

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }
  }, [callState.muted, currentUser]);

  const triggerRenegotiation = useCallback(async () => {
    const isGroup = chats.find(c => c.id === callState.chatId)?.type === 'group';
    if (isGroup) {
      Object.keys(pcsRef.current).forEach(async (peerId) => {
        const pcInstance = pcsRef.current[peerId];
        if (pcInstance && activeCallChannelRef.current) {
          try {
            const offer = await pcInstance.createOffer();
            await pcInstance.setLocalDescription(offer);
            activeCallChannelRef.current.send({
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
      });
    } else {
      if (pcRef.current && activeCallChannelRef.current) {
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
    }
  }, [callState.chatId, chats, currentUser]);

  const toggleCallVideo = useCallback(async () => {
    if (callState.status !== 'connected') return;

    const isGroup = chats.find(c => c.id === callState.chatId)?.type === 'group';

    if (localVideoStream) {
      localVideoStream.getTracks().forEach(track => track.stop());
      localVideoStreamRef.current = null;
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      wasCameraActiveRef.current = false;
      
      const removeVideoTrack = (pcInstance) => {
        const senders = pcInstance.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) pcInstance.removeTrack(videoSender);
      };

      if (isGroup) {
        Object.keys(pcsRef.current).forEach(peerId => {
          if (pcsRef.current[peerId]) removeVideoTrack(pcsRef.current[peerId]);
        });
      } else if (pcRef.current) {
        removeVideoTrack(pcRef.current);
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
          Object.keys(pcsRef.current).forEach(peerId => {
            if (pcsRef.current[peerId]) pcsRef.current[peerId].addTrack(videoTrack, stream);
          });
          await triggerRenegotiation();
        } else if (pcRef.current) {
          pcRef.current.addTrack(videoTrack, stream);
          await triggerRenegotiation();
        }
      } catch (err) {
        console.error("Failed to capture video:", err);
        alert("Не удалось получить доступ к камере!");
      }
    }
  }, [callState.status, localVideoStream, callState.chatId, chats, triggerRenegotiation]);

  const cleanupVideoTracks = useCallback(async () => {
    if (localVideoStreamRef.current) {
      localVideoStreamRef.current.getTracks().forEach(track => track.stop());
      localVideoStreamRef.current = null;
    }
    setLocalVideoStream(null);

    const isGroup = chats.find(c => c.id === callState.chatId)?.type === 'group';
    if (isGroup) {
      Object.keys(pcsRef.current).forEach(peerId => {
        const pcInstance = pcsRef.current[peerId];
        if (pcInstance) {
          const senders = pcInstance.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) pcInstance.removeTrack(videoSender);
        }
      });
    } else if (pcRef.current) {
      const senders = pcRef.current.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender) pcRef.current.removeTrack(videoSender);
    }

    if (activeCallChannelRef.current) {
      activeCallChannelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { type: 'video-stopped' }
      });
      await triggerRenegotiation();
    }
  }, [callState.chatId, chats, triggerRenegotiation]);

  const stopScreenSharing = useCallback(async (revertToCamera = false) => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    if (revertToCamera && wasCameraActiveRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        setLocalVideoStream(stream);
        localVideoStreamRef.current = stream;
        
        const videoTrack = stream.getVideoTracks()[0];
        const isGroup = chats.find(c => c.id === callState.chatId)?.type === 'group';

        const replaceOrAdd = async (pcInstance) => {
          const senders = pcInstance.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(videoTrack);
          } else {
            pcInstance.addTrack(videoTrack, stream);
          }
        };

        if (isGroup) {
          Object.keys(pcsRef.current).forEach(async (peerId) => {
            if (pcsRef.current[peerId]) await replaceOrAdd(pcsRef.current[peerId]);
          });
          await triggerRenegotiation();
        } else if (pcRef.current) {
          await replaceOrAdd(pcRef.current);
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
  }, [cleanupVideoTracks, triggerRenegotiation, callState.chatId, chats]);

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
            localVideoStreamRef.current.getTracks().forEach(track => track.stop());
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

        const isGroup = chats.find(c => c.id === callState.chatId)?.type === 'group';
        const replaceOrAdd = async (pcInstance) => {
          const senders = pcInstance.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          } else {
            pcInstance.addTrack(screenTrack, screenStream);
          }
        };

        if (isGroup) {
          Object.keys(pcsRef.current).forEach(async (peerId) => {
            if (pcsRef.current[peerId]) await replaceOrAdd(pcsRef.current[peerId]);
          });
          await triggerRenegotiation();
        } else if (pcRef.current) {
          await replaceOrAdd(pcRef.current);
        }
      } catch (err) {
        console.error("Failed screen share:", err);
        if (wasCameraActiveRef.current) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            setLocalVideoStream(stream);
            localVideoStreamRef.current = stream;
            
            const videoTrack = stream.getVideoTracks()[0];
            const isGroup = chats.find(c => c.id === callState.chatId)?.type === 'group';
            const replaceOrAdd = async (pcInstance) => {
              const senders = pcInstance.getSenders();
              const videoSender = senders.find(s => s.track && s.track.kind === 'video');
              if (videoSender) {
                videoSender.replaceTrack(videoTrack);
              } else {
                pcInstance.addTrack(videoTrack, stream);
              }
            };

            if (isGroup) {
              Object.keys(pcsRef.current).forEach(async (peerId) => {
                if (pcsRef.current[peerId]) await replaceOrAdd(pcsRef.current[peerId]);
              });
              await triggerRenegotiation();
            } else if (pcRef.current) {
              await replaceOrAdd(pcRef.current);
              await triggerRenegotiation();
            }
          } catch (cameraErr) {
            console.error(cameraErr);
          }
        }
        wasCameraActiveRef.current = false;
      }
    }
  }, [callState.status, isScreenSharing, localVideoStream, stopScreenSharing, triggerRenegotiation, callState.chatId, chats]);

  return (
    <CallContext.Provider value={{
      callState,
      setCallState,
      startCall,
      endCall,
      toggleCallMute,
      acceptCall,
      rejectCall,
      localVideoStream,
      remoteVideoStream,
      toggleCallVideo,
      isScreenSharing,
      toggleCallScreenShare,
      groupCallParticipants,
      setGroupCallParticipants
    }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCalls = () => useContext(CallContext);
