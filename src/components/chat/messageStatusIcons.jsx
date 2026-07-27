import React from 'react';

const SingleCheck = ({ className }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const DoubleCheck = ({ className }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="6" r="3.5" fill="currentColor" />
  </svg>
);

const PendingClock = ({ className }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: '10px', height: '10px' }}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);


export { SingleCheck, DoubleCheck, PendingClock };
