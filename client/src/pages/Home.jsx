import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, MapPin, Calendar, List } from 'lucide-react'
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
  const sentinelRef = useRef(null)
  const searchRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)

  async function load(){
    setLoading(true)
    try {
      const { data } = await api.get('/photos', { params: { q, category, tag } })
      setItems(data)
    } catch (error) {
      console.error('加载照片失败:', error)
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

  useEffect(()=>{ load(); loadCarousel() },[])

  useEffect(()=>{
    const fn = ()=> setIsMobile(window.innerWidth <= 768)
    fn()
    window.addEventListener('resize', fn)
    return ()=> window.removeEventListener('resize', fn)
  }, [])

  useEffect(()=>{
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries)=>{
      const e = entries[0]
      setLift(e.isIntersecting)
    }, { threshold: 0, rootMargin: '0px 0px -20% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [sentinelRef.current])

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
          <div className="hero-wrap" style={{
            margin: 0
          }}>
            <Carousel items={carousel} interval={5000} fullscreen heightDesktop="72vh" heightMobile="50vh" fit="cover" />
            <div ref={sentinelRef} style={{height: 1}} />
          </div>
        ) : (
          <div
            className="home-hero hero-wrap"
            style={{
              minHeight: '72vh',
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

      <div style={{padding: '0 var(--spacing-xl)', marginTop: 'clamp(20px, 3vh, 30px)'}}>
        <div ref={searchRef} className="hero-search" style={{position: 'static', transform: `${lift ? 'translateY(-6px)' : 'translateY(0)'} translateZ(0)`, margin: '0 auto', maxWidth: 1100, transition: 'transform 0.35s ease-in-out, box-shadow 0.35s ease-in-out', willChange: 'transform'}}>
          <div style={{position:'relative'}}>
            <input
              className="input"
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="地点 / 关键词"
              style={{paddingLeft: 40}}
            />
            <MapPin size={18} style={{position:'absolute', left: 14, top: '50%', transform:'translateY(-50%)', color:'var(--color-muted)'}} />
          </div>
          <div style={{position:'relative'}}>
            <input
              className="input"
              value={category}
              onChange={e=>setCategory(e.target.value)}
              placeholder="类型"
              style={{paddingLeft: 40}}
            />
            <List size={18} style={{position:'absolute', left: 14, top: '50%', transform:'translateY(-50%)', color:'var(--color-muted)'}} />
          </div>
          <div style={{position:'relative'}}>
            <input
              className="input"
              value={tag}
              onChange={e=>setTag(e.target.value)}
              placeholder="日期"
              style={{paddingLeft: 40}}
            />
            <Calendar size={18} style={{position:'absolute', left: 14, top: '50%', transform:'translateY(-50%)', color:'var(--color-muted)'}} />
          </div>
          <button className="btn btn-primary" onClick={load} style={{padding: '12px 20px'}}>
            <Search size={18} />
          </button>
        </div>
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
        ) : (
          <div className="masonry">
            {items.map((it) => (
              <Link
                key={it.id}
                to={`/photos/${it.id}`}
                className="card"
              >
                <div className="photo-card">
                  <img
                    src={it.thumb_url}
                    srcSet={`${it.thumb_url} 480w, ${it.image_url} 2000w`}
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
            ))}
          </div>
        )}
    </div>
  )
}