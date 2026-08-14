import React, { useState, useEffect } from 'react';

import { BACKEND_BASE } from '../api.js';

// Single configurable variable for the video path
export const PUBLIC_VIDEO_PATH = "/assets/header_video.mp4";

export default function BackgroundVideo() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile viewport (width <= 768px)
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Subtle delay to prioritize main content loading (lazy-load)
    const timer = setTimeout(() => {
      setShouldLoad(true);
    }, 100);

    return () => {
      window.removeEventListener('resize', checkMobile);
      clearTimeout(timer);
    };
  }, []);

  // Determine the correct source: stream local files from the backend, load URLs directly
  const isLocalPath = /^[a-zA-Z]:\\|^file:\/\//.test(PUBLIC_VIDEO_PATH);
  const videoSrc = isLocalPath
    ? `${BACKEND_BASE}/api/video?path=${encodeURIComponent(PUBLIC_VIDEO_PATH)}`
    : PUBLIC_VIDEO_PATH;

  return (
    <div className="hero-video-container">
      {shouldLoad && (
        <video
          className="hero-video"
          src={videoSrc}
          muted
          autoPlay
          loop
          playsInline
          controls={false}
          preload="auto"
        />
      )}
      <div className="hero-video-overlay" />
    </div>
  );
}
