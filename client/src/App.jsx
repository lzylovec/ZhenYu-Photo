import React from 'react'
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { Camera, Upload as IconUpload, User, LogOut, LogIn } from 'lucide-react'
import Home from './pages/Home'
import Detail from './pages/Detail'
import Upload from './pages/Upload'
import Login from './pages/Login'
import Profile from './pages/Profile'
import AdminCarousel from './pages/AdminCarousel'

function Nav() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const [compact, setCompact] = React.useState(false)
  const [hidden, setHidden] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)
  const lastYRef = React.useRef(0)
  const tickingRef = React.useRef(false)
  const navRef = React.useRef(null)
  function logout() {
    localStorage.removeItem('token')
    navigate('/')
  }
  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    const setMq = () => setIsMobile(mql.matches)
    setMq()
    mql.addEventListener('change', setMq)
    lastYRef.current = window.scrollY || 0
    function onScroll() {
      const y = window.scrollY || 0
      if (tickingRef.current) return
      tickingRef.current = true
      requestAnimationFrame(() => {
        const down = y > lastYRef.current
        const delta = Math.abs(y - lastYRef.current)
        const cTh = isMobile ? 4 : 8
        const hBase = isMobile ? 60 : 80
        const dTh = isMobile ? 14 : 20
        setCompact(y > cTh)
        setHidden(down && y > hBase && delta > dTh)
        lastYRef.current = y
        tickingRef.current = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    requestAnimationFrame(() => setMounted(true))
    return () => {
      window.removeEventListener('scroll', onScroll)
      mql.removeEventListener('change', setMq)
    }
  }, [])
  function onTransitionEnd(e){
    if (e.target !== navRef.current) return
    const detail = { compact, hidden }
    document.dispatchEvent(new CustomEvent('nav-transition-end', { detail }))
  }
  return (
    <nav ref={navRef} onTransitionEnd={onTransitionEnd} className={`nav ${mounted ? 'nav--ready' : 'nav--boot'} ${compact ? 'nav--compact' : ''} ${hidden ? 'nav--hidden' : ''}`}>
      <Link to="/" className="nav-brand">
        <Camera size={28} style={{ marginRight: 'var(--spacing-sm)' }} />
        <span style={{ fontWeight: 'var(--font-weight-bold)' }}>彩虹影展</span>
      </Link>
      <div className="nav-links">
        {token && (
          <Link to="/admin-carousel" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <IconUpload size={18} />
            <span>首页轮播图</span>
          </Link>
        )}
        {token && (
          <Link to="/upload" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <IconUpload size={18} />
            <span>上传</span>
          </Link>
        )}
        {token && (
          <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <User size={18} />
            <span>我的作品</span>
          </Link>
        )}
        {!token ? (
          <Link to="/admin-login" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <LogIn size={18} />
            <span>管理员登录</span>
          </Link>
        ) : (
          <button className="btn" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <LogOut size={18} />
            <span>退出</span>
          </button>
        )}
      </div>
    </nav>
  )
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const initRef = React.useRef(false)
  React.useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    const p = location.pathname
    const token = localStorage.getItem('token')
    if (p === '/login' || p === '/admin') {
      navigate('/', { replace: true })
    }
    if (p === '/upload' && !token) {
      navigate('/', { replace: true })
    }
  }, [])
  return (
    <div>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/photos/:id" element={<Detail />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/admin-carousel" element={<AdminCarousel />} />
        <Route path="/admin-login" element={<Login />} />
        <Route path="/admin" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  )
}