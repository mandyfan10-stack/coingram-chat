import React, { useState } from 'react';
import { Send } from 'lucide-react';

export default function PulseCommentInput({ tSec, onSubmit, disabled }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    const body = text.trim();
    if (!body || busy || disabled) return;
    setBusy(true);
    try {
      await onSubmit(body);
      setText('');
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="pulse-cmt-form" onSubmit={submit}>
      <input
        type="text"
        className="pulse-cmt-input"
        placeholder={`Коммент на ${Math.floor(tSec || 0)}с…`}
        value={text}
        maxLength={280}
        disabled={disabled || busy}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        className="pulse-cmt-send"
        disabled={disabled || busy || !text.trim()}
        aria-label="Отправить"
      >
        <Send size={14} />
      </button>
    </form>
  );
}
