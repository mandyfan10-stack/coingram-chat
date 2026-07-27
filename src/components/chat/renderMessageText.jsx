import React from 'react';

function renderMessageTextWithLinks(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      let href = part;
      let display = part;
      
      const trailingPunctuation = /[.,!?;)]+$/;
      const match = part.match(trailingPunctuation);
      let trailing = "";
      if (match) {
        trailing = match[0];
        href = part.substring(0, part.length - trailing.length);
        display = href;
      }
      
      return (
        <React.Fragment key={i}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {display}
          </a>
          {trailing}
        </React.Fragment>
      );
    }
    return part;
  });
}

export { renderMessageTextWithLinks };
