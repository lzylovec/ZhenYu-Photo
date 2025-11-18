import React, { useEffect, useRef, useState } from 'react'

export default function Carousel({ items = [], interval = 5000, fullscreen = false, heightDesktop = '72vh', heightMobile = '50vh', fit = 'cover' }){
  const [index, setIndex] = useState(0)
  const timerRef = useRef(null)
  const touchRef = useRef({ x: 0, y: 0, active: false })
  const [height, setHeight] = useState(heightDesktop)
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    if (!items.length) return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, interval)
    return () => clearInterval(timerRef.current)
  }, [items.length, interval])

  useEffect(() => {
    function calc(){
      const w = window.innerWidth
      setHeight(w >= 1024 ? heightDesktop : heightMobile)
      setIsDesktop(w >= 1024)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [heightDesktop, heightMobile])

  function go(i){
    if (!items.length) return
    const n = (i + items.length) % items.length
    setIndex(n)
  }

  function onTouchStart(e){
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, active: true }
    clearInterval(timerRef.current)
  }
  function onTouchMove(e){
    if (!touchRef.current.active) return
    const t = e.touches[0]
    const dx = t.clientX - touchRef.current.x
    const threshold = 30
    if (Math.abs(dx) > threshold){
      go(index + (dx < 0 ? 1 : -1))
      touchRef.current.active = false
    }
  }
  function onTouchEnd(){
    touchRef.current.active = false
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, interval)
  }

  return (
    <div
      className="carousel"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: fullscreen ? 0 : 'var(--radius)',
        boxShadow: fullscreen ? 'none' : 'var(--shadow)',
        background: fit === 'contain' ? '#000' : 'var(--color-hero-bg)',
        width: '100%',
        height: fullscreen ? height : 'auto',
        transition: 'background-color 0.35s ease-in-out'
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="carousel-track"
        style={{
          display: 'flex',
          transform: `translateX(-${index * 100}%)`,
          transition: 'transform 0.6s ease',
          height: fullscreen ? '100%' : 'auto'
        }}
      >
        {items.map((it, i) => (
          <div key={it.id || i} style={{flex: '0 0 100%', position: 'relative', height: fullscreen ? '100%' : 'auto'}}>
            <img
              src={it.image_url}
              srcSet={`${it.thumb_url || it.image_url} 480w, ${it.image_url} 2560w`}
              sizes={fullscreen ? '(max-width:768px) 100vw, 100vw' : '100vw'}
              loading={i === index ? 'eager' : 'lazy'}
              fetchpriority={i === index ? 'high' : 'low'}
              decoding="async"
              alt={it.title || `轮播图 ${i+1}`}
              style={{
                width: '100%',
                height: fullscreen ? '100%' : 'auto',
                display: 'block',
                objectFit: fit === 'contain' ? 'contain' : 'cover',
                transform: 'translateZ(0)'
              }}
            />
            {fullscreen && (
              <div
                className="carousel-title"
                style={{
                  position: 'absolute', left: isDesktop ? 24 : 12, bottom: isDesktop ? 24 : 12, color: '#fff',
                  padding: 0,
                  lineHeight: 1.25, maxWidth: '70%',
                  textShadow: '0 2px 6px rgba(0,0,0,0.45)', fontWeight: 600,
                  opacity: i === index ? 1 : 0, transform: i === index ? 'translateY(0)' : 'translateY(6px)',
                  transition: 'opacity 0.6s ease, transform 0.6s ease', zIndex: 1, pointerEvents: 'none'
                }}
              >
                {it.title || ''}
              </div>
            )}
          </div>
        ))}
      </div>

      {fullscreen && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 'clamp(64px, 12vw, 100px)',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0), var(--color-bg))',
            pointerEvents: 'none'
          }}
        />
      )}

      {/* 导航按钮 */}
      <button
        aria-label="prev"
        onClick={() => go(index - 1)}
        className="btn"
        style={{
          position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(0,0,0,0.35)', color: '#fff',
          width: 28, height: 28, padding: 10, borderRadius: 9999,
          border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', opacity: 0.85
        }}
      >
        ◀
      </button>
      <button
        aria-label="next"
        onClick={() => go(index + 1)}
        className="btn"
        style={{
          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(0,0,0,0.35)', color: '#fff',
          width: 28, height: 28, padding: 10, borderRadius: 9999,
          border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', opacity: 0.85
        }}
      >
        ▶
      </button>

      {/* 分页指示器 */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: '12px', display: 'flex', justifyContent: 'center', gap: '8px'
      }}>
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`第${i+1}张`}
            className="btn"
            style={{
              width: '10px', height: '10px', borderRadius: '50%', padding: 0,
              background: i === index ? 'var(--color-primary)' : 'rgba(255,255,255,0.7)'
            }}
          />
        ))}
      </div>
      {/* 预加载下一张，保证切换后立即高清呈现 */}
      {items.length > 1 && (
        <link rel="preload" as="image" href={items[(index + 1) % items.length]?.image_url} />
      )}
    </div>
  )
}