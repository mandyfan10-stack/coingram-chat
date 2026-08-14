import React from 'react';

/**
 * 100% Custom Vector SVG Artwork for Coingram Rewards & Mystery Boxes
 * No external images or emojis — pure mathematical SVG geometry with gradients and glows.
 */

export function SvgCrown({ size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="goldCrownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff5b8" />
          <stop offset="35%" stopColor="#fbbf24" />
          <stop offset="75%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <radialGradient id="rubyGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff4d4d" />
          <stop offset="70%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
        <filter id="crownShine" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Background glow halo */}
      <circle cx="32" cy="32" r="26" fill="#fbbf24" fillOpacity="0.15" />
      {/* Crown base */}
      <path d="M12 44H52L49 48H15L12 44Z" fill="url(#goldCrownGrad)" stroke="#78350f" strokeWidth="1.5" />
      <path d="M10 24L18 42H46L54 24L40 32L32 14L24 32L10 24Z" fill="url(#goldCrownGrad)" stroke="#78350f" strokeWidth="1.5" filter="url(#crownShine)" />
      {/* Gemstones */}
      <circle cx="10" cy="24" r="3.5" fill="url(#rubyGlow)" stroke="#fff" strokeWidth="1" />
      <circle cx="32" cy="14" r="4.5" fill="url(#rubyGlow)" stroke="#fff" strokeWidth="1.2" />
      <circle cx="54" cy="24" r="3.5" fill="url(#rubyGlow)" stroke="#fff" strokeWidth="1" />
      <circle cx="32" cy="40" r="3" fill="#38bdf8" stroke="#fff" strokeWidth="0.8" />
      <circle cx="22" cy="40" r="2.5" fill="#a855f7" stroke="#fff" strokeWidth="0.8" />
      <circle cx="42" cy="40" r="2.5" fill="#a855f7" stroke="#fff" strokeWidth="0.8" />
    </svg>
  );
}

export function SvgFlame({ size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="flameOuter" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#b91c1c" />
          <stop offset="40%" stopColor="#ea580c" />
          <stop offset="80%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fef08a" />
        </linearGradient>
        <linearGradient id="flameInner" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="60%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="36" r="24" fill="#ea580c" fillOpacity="0.18" />
      {/* Outer flame */}
      <path d="M32 8C32 8 38 18 36 26C39 22 42 20 44 24C48 30 50 38 46 46C42 54 34 56 26 54C16 52 12 42 16 32C18 26 24 22 24 16C24 12 28 8 32 8Z" fill="url(#flameOuter)" />
      {/* Inner flame */}
      <path d="M32 22C32 22 36 28 35 34C37 32 39 30 40 33C42 37 42 42 39 46C36 50 31 51 27 49C22 47 20 42 22 36C23 32 27 30 27 26C27 24 30 22 32 22Z" fill="url(#flameInner)" />
      {/* Embers */}
      <circle cx="20" cy="18" r="1.5" fill="#fef08a" opacity="0.8" />
      <circle cx="46" cy="16" r="1.2" fill="#fef08a" opacity="0.9" />
      <circle cx="38" cy="10" r="1" fill="#fef08a" opacity="0.7" />
    </svg>
  );
}

export function SvgDiamond({ size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="diamondFace1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id="diamondFace2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#c7d2fe" />
        </linearGradient>
        <linearGradient id="diamondFace3" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="25" fill="#818cf8" fillOpacity="0.2" />
      {/* Top facets */}
      <polygon points="20,16 44,16 54,28 10,28" fill="url(#diamondFace2)" stroke="#312e81" strokeWidth="1" />
      <polygon points="20,16 32,28 10,28" fill="url(#diamondFace1)" stroke="#312e81" strokeWidth="1" />
      <polygon points="44,16 32,28 54,28" fill="url(#diamondFace3)" stroke="#312e81" strokeWidth="1" />
      <polygon points="20,16 32,16 32,28" fill="#ffffff" fillOpacity="0.6" />
      {/* Bottom facets */}
      <polygon points="10,28 32,54 32,28" fill="url(#diamondFace1)" stroke="#312e81" strokeWidth="1" />
      <polygon points="54,28 32,54 32,28" fill="url(#diamondFace3)" stroke="#312e81" strokeWidth="1" />
      <polygon points="20,28 32,54 44,28" fill="url(#diamondFace2)" stroke="#312e81" strokeWidth="1" />
      {/* Sparkles */}
      <path d="M50 12L52 16L56 18L52 20L50 24L48 20L44 18L48 16L50 12Z" fill="#ffffff" />
    </svg>
  );
}

export function SvgShield({ size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
        <linearGradient id="shieldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="#10b981" fillOpacity="0.18" />
      {/* Outer shield */}
      <path d="M32 10L50 16V30C50 42 42 51 32 55C22 51 14 42 14 30V16L32 10Z" fill="url(#shieldGrad)" stroke="url(#shieldBorder)" strokeWidth="2.5" />
      {/* Tactical matrix lines */}
      <path d="M32 16V49" stroke="#a7f3d0" strokeWidth="1.5" strokeDasharray="3 2" />
      <path d="M20 28H44" stroke="#a7f3d0" strokeWidth="1.5" opacity="0.6" />
      <path d="M22 38H42" stroke="#a7f3d0" strokeWidth="1.5" opacity="0.6" />
      <circle cx="32" cy="28" r="4" fill="#ffffff" />
    </svg>
  );
}

export function SvgLightning({ size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#67e8f9" />
          <stop offset="70%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0e7490" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="25" fill="#06b6d4" fillOpacity="0.22" />
      <path d="M36 8L16 34H32L26 56L48 28H32L36 8Z" fill="url(#boltGrad)" stroke="#ecfeff" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="48" cy="28" r="2" fill="#ffffff" />
      <circle cx="16" cy="34" r="2" fill="#ffffff" />
    </svg>
  );
}

export function SvgRocket({ size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="rocketBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="60%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="25" fill="#38bdf8" fillOpacity="0.18" />
      {/* Thruster exhaust */}
      <path d="M22 42L14 54C18 52 24 50 26 44L22 42Z" fill="#ef4444" />
      <path d="M18 46L12 56C16 54 20 52 22 48L18 46Z" fill="#facc15" />
      {/* Wings */}
      <path d="M24 30L16 42L28 44L24 30Z" fill="#3b82f6" />
      <path d="M34 20L46 32L44 44L34 20Z" fill="#3b82f6" />
      {/* Main Hull */}
      <path d="M48 16C48 16 36 14 26 24C18 32 20 44 20 44L44 44C44 44 56 46 48 16Z" fill="url(#rocketBody)" stroke="#1e293b" strokeWidth="1.5" />
      {/* Porthole */}
      <circle cx="38" cy="26" r="4.5" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  );
}

export function SvgCoinBadge({ size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="coinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="45%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="#eab308" fillOpacity="0.18" />
      <circle cx="32" cy="32" r="24" fill="url(#coinGrad)" stroke="#78350f" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="20" fill="#17212b" />
      <circle cx="32" cy="32" r="17" fill="url(#coinGrad)" />
      <path d="M36 28C35 24 30 23 28 25C25 27 25 33 28 35C31 37 35 36 36 32H31" stroke="#17212b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SvgCrystal({ size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="cryst1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0abfc" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="cryst2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="25" fill="#a855f7" fillOpacity="0.2" />
      {/* Cluster shards */}
      <polygon points="18,48 14,32 24,24 26,44" fill="#9333ea" stroke="#581c87" strokeWidth="1" />
      <polygon points="46,48 50,30 38,22 36,44" fill="#7e22ce" stroke="#581c87" strokeWidth="1" />
      {/* Center main crystal */}
      <polygon points="32,10 42,26 32,54 22,26" fill="url(#cryst1)" stroke="#581c87" strokeWidth="1.5" />
      <polygon points="32,10 37,26 32,54" fill="url(#cryst2)" opacity="0.6" />
      <circle cx="32" cy="18" r="1.5" fill="#ffffff" />
    </svg>
  );
}

export function SvgCyberWave({ size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="cyberNeon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="#c084fc" fillOpacity="0.2" />
      <circle cx="32" cy="32" r="22" stroke="url(#cyberNeon)" strokeWidth="3" strokeDasharray="8 4" />
      <polygon points="32,16 46,32 32,48 18,32" stroke="#38bdf8" strokeWidth="2" fill="none" />
      <polygon points="32,22 40,32 32,42 24,32" fill="url(#cyberNeon)" />
      <circle cx="32" cy="32" r="3" fill="#ffffff" />
    </svg>
  );
}

export function SvgCosmicAura({ size = 48, className = '', color = '#38bdf8' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <radialGradient id={`auraGrad_${size}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <stop offset="50%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill={`url(#auraGrad_${size})`} />
      <ellipse cx="32" cy="32" rx="22" ry="8" stroke={color} strokeWidth="1.5" strokeDasharray="6 3" transform="rotate(-25 32 32)" />
      <ellipse cx="32" cy="32" rx="22" ry="8" stroke={color} strokeWidth="1.5" strokeDasharray="6 3" transform="rotate(35 32 32)" />
      <circle cx="32" cy="32" r="6" fill="#ffffff" />
    </svg>
  );
}

export function SvgWeaponCase({ size = 180, className = '' }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="caseBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2d3748" />
          <stop offset="40%" stopColor="#1a202c" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="caseMetalRim" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4a5568" />
          <stop offset="50%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="goldHazard" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <radialGradient id="lockGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="70%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </radialGradient>
        <filter id="neonLockFilter" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Case Shadow */}
      <ellipse cx="100" cy="138" rx="85" ry="10" fill="#000000" fillOpacity="0.5" filter="blur(4px)" />

      {/* Main Rugged Case Body */}
      <rect x="20" y="32" width="160" height="96" rx="14" fill="url(#caseBodyGrad)" stroke="url(#caseMetalRim)" strokeWidth="3" />

      {/* Top Handle Base */}
      <path d="M70 32V20C70 15.58 73.58 12 78 12H122C126.42 12 130 15.58 130 20V32" fill="#1e293b" stroke="#64748b" strokeWidth="3" />
      <rect x="84" y="8" width="32" height="8" rx="4" fill="#334155" />

      {/* Reinforced Corner Bumpers */}
      <path d="M20 46V36C20 33.79 21.79 32 24 32H34" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
      <path d="M180 46V36C180 33.79 178.21 32 176 32H166" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
      <path d="M20 114V124C20 126.21 21.79 128 24 128H34" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
      <path d="M180 114V124C180 126.21 178.21 128 176 128H166" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />

      {/* Horizontal Molded Ribs */}
      <line x1="42" y1="52" x2="158" y2="52" stroke="#0f172a" strokeWidth="3" />
      <line x1="42" y1="54" x2="158" y2="54" stroke="#334155" strokeWidth="1" />
      <line x1="42" y1="106" x2="158" y2="106" stroke="#0f172a" strokeWidth="3" />
      <line x1="42" y1="108" x2="158" y2="108" stroke="#334155" strokeWidth="1" />

      {/* Center Seam Division */}
      <line x1="20" y1="78" x2="180" y2="78" stroke="#090d16" strokeWidth="4" />
      <line x1="20" y1="79" x2="180" y2="79" stroke="#475569" strokeWidth="1" />

      {/* Industrial Latches */}
      <rect x="46" y="70" width="18" height="18" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="55" cy="79" r="2.5" fill="#e2e8f0" />
      <rect x="136" y="70" width="18" height="18" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="145" cy="79" r="2.5" fill="#e2e8f0" />

      {/* Center Electronic Lock Mechanism */}
      <circle cx="100" cy="79" r="18" fill="#0f172a" stroke="#fbbf24" strokeWidth="2.5" />
      <circle cx="100" cy="79" r="13" fill="url(#lockGlow)" filter="url(#neonLockFilter)" />
      
      {/* Keyhole / Coiny Insignia */}
      <path d="M100 73V81M97 78L100 81L103 78" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="100" cy="85" r="1.5" fill="#ffffff" />

      {/* Tactical Stencil Text */}
      <text x="100" y="65" fill="#fbbf24" fontSize="9" fontWeight="800" textAnchor="middle" letterSpacing="2" fontFamily="monospace">
        COINY // BRAVO
      </text>
      <text x="100" y="100" fill="#64748b" fontSize="7" fontWeight="700" textAnchor="middle" letterSpacing="1" fontFamily="sans-serif">
        MIL-SPEC CONTAINER #01
      </text>

      {/* LED Status Indicators */}
      <circle cx="34" cy="78" r="2" fill="#22c55e" filter="url(#neonLockFilter)" />
      <circle cx="166" cy="78" r="2" fill="#22c55e" filter="url(#neonLockFilter)" />
    </svg>
  );
}

/**
 * Maps item to custom SVG component
 */
export function ItemSvgIcon({ item, size = 48, className = '' }) {
  if (!item) return <SvgCoinBadge size={size} className={className} />;

  switch (item.id) {
    case 'frame_royal_gold':
    case 'badge_crown':
      return <SvgCrown size={size} className={className} />;
    case 'frame_inferno_flame':
    case 'badge_fire':
      return <SvgFlame size={size} className={className} />;
    case 'badge_diamond':
      return <SvgDiamond size={size} className={className} />;
    case 'frame_emerald_shield':
      return <SvgShield size={size} className={className} />;
    case 'badge_lightning':
      return <SvgLightning size={size} className={className} />;
    case 'badge_rocket':
      return <SvgRocket size={size} className={className} />;
    case 'frame_amethyst_crystal':
      return <SvgCrystal size={size} className={className} />;
    case 'frame_cyber_wave':
    case 'frame_neon_cyan':
      return <SvgCyberWave size={size} className={className} />;
    case 'glow_solar':
      return <SvgCosmicAura size={size} color="#fbbf24" className={className} />;
    case 'glow_amethyst':
      return <SvgCosmicAura size={size} color="#c084fc" className={className} />;
    case 'glow_sapphire':
      return <SvgCosmicAura size={size} color="#38bdf8" className={className} />;
    case 'badge_coin':
    default:
      return <SvgCoinBadge size={size} className={className} />;
  }
}
