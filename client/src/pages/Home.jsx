import React, { useEffect, useRef, useState } from 'react'
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

  useEffect(()=>{ loadCarousel() },[])
  useEffect(()=>{
    const qs = new URLSearchParams(location.search)
    const qParam = qs.get('q') || ''
    setQ(qParam)
  }, [location.search])
  useEffect(()=>{ load() }, [q, category, tag])

  useEffect(()=>{
    const fn = ()=> setIsMobile(window.innerWidth <= 768)
    fn()
    window.addEventListener('resize', fn)
    return ()=> window.removeEventListener('resize', fn)
  }, [])

  

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
            ))}
          </div>
        )}
    </div>
  )
}