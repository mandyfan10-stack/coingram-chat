import React from 'react';
import { ArrowDown } from 'lucide-react';
import MessageBubble from './MessageBubble';

/**
 * Presentational messages window + scroll-to-bottom control.
 * Scroll pagination / auto-scroll policy stay owned by ChatArea.
 */
export default function MessageList({
  activeChat,
  currentUser,
  chatBodyRef,
  messagesEndRef,
  chatBodyStyle,
  handleScroll,
  showScrollBottom,
  onScrollToBottom,
  showMsgActionsId,
  setShowMsgActionsId,
  retryMenuMsgId,
  setRetryMenuMsgId,
  setReplyingTo,
  setOpenedImageUrl,
  deleteMessage,
  toggleReaction,
  retrySendMessage,
  deleteFailedMessage,
  emojis
}) {
  return (
    <>
      <div
        className="chat-body"
        ref={chatBodyRef}
        onScroll={handleScroll}
        style={chatBodyStyle}
      >
        <div className="messages-list">
          {activeChat.messages.map((msg, index) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              index={index}
              activeChat={activeChat}
              currentUser={currentUser}
              showMsgActionsId={showMsgActionsId}
              setShowMsgActionsId={setShowMsgActionsId}
              retryMenuMsgId={retryMenuMsgId}
              setRetryMenuMsgId={setRetryMenuMsgId}
              setReplyingTo={setReplyingTo}
              setOpenedImageUrl={setOpenedImageUrl}
              deleteMessage={deleteMessage}
              toggleReaction={toggleReaction}
              retrySendMessage={retrySendMessage}
              deleteFailedMessage={deleteFailedMessage}
              emojis={emojis}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {showScrollBottom && (
        <button
          className="scroll-bottom-btn"
          onClick={onScrollToBottom}
        >
          <ArrowDown size={18} />
        </button>
      )}
    </>
  );
}
