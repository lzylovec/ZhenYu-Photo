import React, { useState } from 'react'
import { api } from '../api'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, LogIn, User } from 'lucide-react'

export default function Login(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const nav = useNavigate()

  async function submit(){
    try {
      const { data } = await api.post('/auth/login', { username, password })
      localStorage.setItem('token', data.token)
      try {
        const r = await api.get('/csrf')
        localStorage.setItem('csrf', r.data?.token || '')
      } catch {}
      nav('/')
    } catch(e){
      setError(e.response?.data?.error || '登录失败')
    }
  }

  return (
    <div className="fade-in" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-xl)',
      background: 'var(--color-hero-bg)'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: 'var(--spacing-xl)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--spacing-lg)',
            boxShadow: 'var(--shadow)'
          }}>
            <Camera size={32} style={{color: 'white'}} />
          </div>
          <h2 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text)',
            marginBottom: 'var(--spacing-sm)'
          }}>
            管理员登录
          </h2>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--color-text-light)'
          }}>
            登录以管理摄影作品
          </p>
        </div>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-md)'
        }}>
          <div style={{position: 'relative'}}>
            <input 
              className="input" 
              value={username} 
              onChange={e=>setUsername(e.target.value)} 
              placeholder="管理员用户名" 
              style={{paddingLeft: '48px'}}
            />
            <User size={20} style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-muted)'
            }} />
          </div>
          
          <div style={{position: 'relative'}}>
            <input 
              className="input" 
              type="password" 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              placeholder="密码" 
              style={{paddingLeft: '48px'}}
            />
            <LogIn size={20} style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-muted)'
            }} />
          </div>
          
          {error && (
            <div style={{
              color: 'var(--color-secondary)',
              fontSize: '14px',
              fontWeight: 'var(--font-weight-medium)',
              padding: 'var(--spacing-sm)',
              background: 'rgba(231, 76, 60, 0.1)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(231, 76, 60, 0.2)'
            }}>
              {error}
            </div>
          )}
          
          <button 
            className="btn btn-primary" 
            onClick={submit}
            style={{
              padding: '16px',
              fontSize: '16px',
              fontWeight: 'var(--font-weight-semibold)',
              letterSpacing: '0.5px'
            }}
          >
            <LogIn size={18} style={{marginRight: 'var(--spacing-xs)'}} /> 
            登录
          </button>
        </div>
        
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--spacing-lg)',
          paddingTop: 'var(--spacing-lg)',
          borderTop: '1px solid var(--color-border)'
        }}>
          <p style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--color-text-light)',
            lineHeight: 1.5
          }}>
            💡 此站点浏览无需注册，登录仅管理员上传使用。
          </p>
        </div>
      </div>
    </div>
  )
}