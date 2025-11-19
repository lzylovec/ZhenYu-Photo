import React, { useEffect, useRef, useState } from 'react'

export default function Carousel({ items = [], interval = 5000, fullscreen = false, heightDesktop = '72vh', heightMobile = '50vh', fit = 'cover', flow = false, irregular = false }) {
  const [index, setIndex] = useState(0)
  const timerRef = useRef(null)
  const touchRef = useRef({ x: 0, y: 0, active: false })
  const [height, setHeight] = useState(heightDesktop)
  const [isDesktop, setIsDesktop] = useState(true)
  const loopItems = flow && items.length ? items.concat(items) : items

  useEffect(() => {
    if (flow) return
    if (!items.length) return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, interval)
    return () => clearInterval(timerRef.current)
  }, [items.length, interval, flow])

  useEffect(() => {
    function calc() {
      const w = window.innerWidth
      setHeight(w >= 1024 ? heightDesktop : heightMobile)
      setIsDesktop(w >= 1024)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [heightDesktop, heightMobile])

  function go(i) {
    if (!items.length) return
    const n = (i + items.length) % items.length
    setIndex(n)
  }

  function onTouchStart(e) {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, active: true }
    if (!flow) clearInterval(timerRef.current)
  }
  function onTouchMove(e) {
    if (!touchRef.current.active) return
    const t = e.touches[0]
    const dx = t.clientX - touchRef.current.x
    const threshold = 30
    if (Math.abs(dx) > threshold) {
      if (!flow) go(index + (dx < 0 ? 1 : -1))
      touchRef.current.active = false
    }
  }
  function onTouchEnd() {
    touchRef.current.active = false
    if (!flow) {
      timerRef.current = setInterval(() => {
        setIndex((i) => (i + 1) % items.length)
      }, interval)
    }
  }

  const lanesCount = irregular ? (isDesktop ? 2 : 1) : 1
  const lanes = irregular ? Array.from({ length: lanesCount }, () => []) : []
  if (irregular) {
    items.forEach((it, i) => { lanes[i % lanesCount].push(it) })
  }
  const rand = (s) => { let x = (s * 9301 + 49297) % 233280; return x / 233280 }
  return (
    <div
      className="carousel"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius)',
        boxShadow: fullscreen ? 'none' : 'var(--shadow)',
        background: fit === 'contain' ? '#000' : 'var(--color-hero-bg)',
        width: '100%',
        height: irregular ? 'auto' : (fullscreen ? height : 'auto'),
        transition: 'background-color 0.35s ease-in-out'
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {irregular && flow ? (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateRows: `repeat(${lanesCount}, auto)`, gap: isDesktop ? 'var(--spacing-md)' : 'var(--spacing-sm)' }}>
            {lanes.map((lane, li) => {
              const dur = isDesktop ? [82, 68][li % 2] : [52, 62][li % 2]
              const dir = li % 2 === 0 ? 'irLoopLeft' : 'irLoopRight'
              const laneItems = lane.concat(lane)
              return (
                <div key={'lane-' + li} style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 'var(--spacing-lg)' : 'var(--spacing-md)', willChange: 'transform', animation: `${dir} ${dur}s linear infinite` }}>
                    {laneItems.map((it, i) => {
                      const r = rand(i + li * 17)
                      const mt = (r * (isDesktop ? 24 : 16)) - (isDesktop ? 12 : 8)
                      const rot = (r - 0.5) * (isDesktop ? 2.0 : 1.6)
                      const drift = 3 + Math.floor(r * 3)
                      return (
                        <figure key={(it.id || i) + '-ir-' + li + '-' + i} style={{ flex: '0 0 auto', margin: 0, borderRadius: 'var(--radius)', overflow: 'visible', boxShadow: 'var(--shadow)', display: 'inline-block', marginTop: mt + 'px', transform: `rotate(${rot}deg)` }}>
                          <div style={{ display: 'inline-block', animation: `floatY ${drift}s ease-in-out infinite alternate` }}>
                            <img
                              src={it.image_url}
                              srcSet={`${it.thumb_url || it.image_url} 480w, ${it.image_url} 2560w`}
                              sizes="100vw"
                              loading={li === 0 && i < 3 ? 'eager' : 'lazy'}
                              fetchpriority={li === 0 && i < 3 ? 'high' : 'low'}
                              decoding="async"
                              alt={it.title || `轮播图 ${i + 1}`}
                              style={{ width: 'auto', height: 'auto', maxHeight: isDesktop ? '28vh' : '22vh', display: 'block', objectFit: 'contain', borderRadius: 'var(--radius)', background: 'transparent' }}
                            />
                          </div>
                        </figure>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="ribbon-mask-top" />
          <div className="ribbon-mask-bottom" />
        </div>
      ) : (
        <div
          className={`carousel-track${flow ? ' flow-carousel-track' : ''}`}
          style={{
            display: 'flex',
            gap: flow ? (isDesktop ? 'var(--spacing-lg)' : 'var(--spacing-md)') : undefined,
            transform: flow ? undefined : `translateX(-${index * 100}%)`,
            transition: flow ? undefined : 'transform 0.6s ease',
            height: fullscreen ? '100%' : 'auto',
            animationDuration: flow ? (isDesktop ? '80s' : '50s') : undefined
          }}
        >
          {loopItems.map((it, i) => (
            <div
              key={(it.id || i) + '-' + (flow ? 'flow' : 'norm')}
              style={{
                flex: flow ? '0 0 auto' : '0 0 100%',
                position: 'relative',
                width: flow ? (isDesktop ? 'min(420px, 32vw)' : '78vw') : '100%',
                height: fullscreen ? '100%' : 'auto',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow)',
                border: '1px solid var(--color-border)'
              }}
            >
              <img
                src={it.image_url}
                srcSet={`${it.thumb_url || it.image_url} 480w, ${it.image_url} 2560w`}
                sizes={flow ? (isDesktop ? '32vw' : '78vw') : (fullscreen ? '(max-width:768px) 100vw, 100vw' : '100vw')}
                loading={i === index ? 'eager' : 'lazy'}
                fetchpriority={i === index ? 'high' : 'low'}
                decoding="async"
                alt={it.title || `轮播图 ${i + 1}`}
                style={{
                  width: '100%',
                  height: fullscreen ? '100%' : 'auto',
                  display: 'block',
                  objectFit: fit === 'contain' ? 'contain' : 'cover',
                  transform: 'translateZ(0)',
                  borderRadius: 'var(--radius)'
                }}
              />
              {fullscreen && !flow && (
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
      )}

      {fullscreen && !flow && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
          height: 'clamp(80px, 12vw, 60px)',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0), var(--color-bg))',
            pointerEvents: 'none'
          }}
        />
      )}

      {!flow && !irregular && (
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
      )}
      {!flow && !irregular && (
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
      )}

      {!flow && !irregular && (
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: '12px', display: 'flex', justifyContent: 'center', gap: '8px'
      }}>
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`第${i + 1}张`}
            className="btn"
            style={{
              width: '10px', height: '10px', borderRadius: '50%', padding: 0,
              background: i === index ? 'var(--color-primary)' : 'rgba(255,255,255,0.7)'
            }}
          />
        ))}
      </div>
      )}
      {!flow && !irregular && items.length > 1 && (
        <link rel="preload" as="image" href={items[(index + 1) % items.length]?.image_url} />
      )}
    </div>
  )
}