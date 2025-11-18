import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api'
import Carousel from '../components/Carousel'

export default function Home(){
  const [items, setItems] = useState([])
  const [carousel, setCarousel] = useState([])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [tag, setTag] = useState('')
  const [loading, setLoading] = useState(true)
  const [cLoading, setCLoading] = useState(true)
  const [lift, setLift] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const location = useLocation()
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [fillLogs, setFillLogs] = useState([])
  const gridRef = useRef(null)
  const sentinelRef = useRef(null)

  async function load(reset = false){
    setLoading(true)
    setError('')
    const pageSize = 30
    const nextPage = reset ? 1 : page
    try {
      const { data } = await api.get('/photos', { params: { q, category, tag, page: nextPage, pageSize } })
      if (reset) {
        setItems(Array.isArray(data) ? data : [])
        setPage(2)
      } else {
        setItems(prev => prev.concat(Array.isArray(data) ? data : []))
        setPage(nextPage + 1)
      }
      setHasMore(Array.isArray(data) ? data.length >= pageSize : false)
    } catch (e) {
      setError('作品加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadCarousel(){
    setCLoading(true)
    try {
      const { data } = await api.get('/carousel')
      setCarousel(Array.isArray(data) ? data.slice(0, 9) : [])
    } catch (e) {
      setCarousel([])
    } finally {
      setCLoading(false)
    }
  }

  useEffect(()=>{ loadCarousel() },[])
  useEffect(()=>{
    const qs = new URLSearchParams(location.search)
    const qParam = qs.get('q') || ''
    setQ(qParam)
  }, [location.search])
  useEffect(()=>{ load(true) }, [q, category, tag])

  useEffect(()=>{
    const fn = ()=> setIsMobile(window.innerWidth <= 768)
    fn()
    window.addEventListener('resize', fn)
    return ()=> window.removeEventListener('resize', fn)
  }, [])

  function needsFill(){
    const grid = gridRef.current
    if (!grid) return false
    const h = grid.getBoundingClientRect().height
    const vh = window.innerHeight || 800
    return h < vh * 0.9
  }

  async function autoFill(){
    let tries = 0
    while (needsFill() && hasMore && tries < 3) {
      await load(false)
      tries++
    }
    if (needsFill()) {
      setFillLogs(l => l.concat([{ ts: Date.now(), type: 'blank_persist', page, count: items.length }]))
    }
  }

  useEffect(()=>{ if (!loading) autoFill() }, [loading, items])

  useEffect(()=>{ if (fillLogs.length) console.warn('masonry-fill-log', fillLogs[fillLogs.length-1]) }, [fillLogs])

  useEffect(()=>{
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries)=>{
      const e = entries[0]
      if (e.isIntersecting && hasMore && !loading) {
        load(false)
      }
    }, { rootMargin: '200px' })
    io.observe(el)
    return ()=> io.disconnect()
  }, [hasMore, loading])

  function MasonryItem({ children }){
    const ref = useRef(null)
    const [span, setSpan] = useState(1)
    useLayoutEffect(()=>{
      const grid = gridRef.current
      const el = ref.current
      if (!grid || !el) return
      const compute = ()=>{
        const styles = window.getComputedStyle(grid)
        const rowH = parseFloat(styles.getPropertyValue('grid-auto-rows')) || 8
        const gap = parseFloat(styles.getPropertyValue('gap')) || parseFloat(styles.getPropertyValue('grid-row-gap')) || 16
        const s = Math.ceil((el.scrollHeight + gap) / (rowH + gap))
        setSpan(s)
      }
      compute()
      const ro = new ResizeObserver(compute)
      ro.observe(el)
      return ()=> ro.disconnect()
    }, [])
    return (
      <div ref={ref} className="masonry-item" style={{ gridRowEnd: `span ${span}` }}>
        {children}
      </div>
    )
  }
  

  return (
    <div className="fade-in">
      <div style={{padding: 0}}>
        {cLoading ? (
          <div style={{
            height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-light)'
          }}>
            加载首页轮播图...
          </div>
        ) : carousel.length > 0 ? (
          <div className="hero-wrap">
            <Carousel items={carousel} interval={5000} fullscreen heightDesktop="80vh" heightMobile="58vh" fit="cover" />
          </div>
        ) : (
          <div
            className="home-hero hero-wrap"
            style={{
              minHeight: '80vh',
              position: 'relative',
              background: items.length > 0 ? `url(${items[0].image_url}) center / cover no-repeat` : 'var(--color-hero-bg)'
            }}
          >
            <div className="hero-title" style={{fontSize: '56px'}}>
              {items[0]?.title || '最新精选作品'}
            </div>
          </div>
        )}
      </div>


        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--spacing-2xl)',
            color: 'var(--color-text-light)'
          }}>
            <div style={{
              display: 'inline-block',
              width: '40px',
              height: '40px',
              border: '3px solid var(--color-border)',
              borderTop: '3px solid var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: 'var(--spacing-md)'
            }}></div>
            <div style={{
              fontSize: '16px',
              fontWeight: 'var(--font-weight-medium)'
            }}>
              正在加载摄影作品...
            </div>
          </div>
        ) : items.length === 0 ? (
          <div>
            <div style={{
              textAlign: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-light)'
            }}>
              <div style={{
                fontSize: '18px',
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                暂无摄影作品
              </div>
              <div style={{
                fontSize: '14px'
              }}>
                尝试调整搜索条件或稍后再试
              </div>
            </div>
            <div className="masonry" ref={gridRef}>
              {Array.from({ length: isMobile ? 6 : 9 }).map((_, i) => (
                <div key={i} className="masonry-item" style={{ gridRowEnd: 'span 24' }}>
                  <div className="masonry-placeholder" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="masonry" ref={gridRef}>
            {items.map((it) => (
              <MasonryItem key={it.id}>
                <Link
                  to={`/photos/${it.id}`}
                  className="card"
                >
                  <div className="photo-card">
                    <img
                      src={it.thumb_url || it.image_url}
                      srcSet={`${(it.thumb_url || it.image_url) ?? ''} 480w, ${(it.image_url || it.thumb_url) ?? ''} 2000w`}
                      sizes="(max-width:480px) 100vw, (max-width:768px) 50vw, 33vw"
                      loading="lazy"
                      alt={it.title}
                      className="img-hover-effect"
                      style={{ width: '100%', display: 'block' }}
                    />
                    <div className="overlay">
                      <div style={{
                        fontWeight: 'var(--font-weight-semibold)',
                        fontSize: '16px',
                        marginBottom: 'var(--spacing-xs)'
                      }}>
                        {it.title}
                      </div>
                      <div style={{
                        opacity: 0.9,
                        fontSize: '14px'
                      }}>
                        {it.author}
                      </div>
                    </div>
                  </div>
                </Link>
              </MasonryItem>
            ))}
            <div ref={sentinelRef} style={{ height: 1 }} />
          </div>
        )}
    </div>
  )
}