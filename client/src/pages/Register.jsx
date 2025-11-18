import React, { useState } from 'react'
import { api } from '../api'
import { useNavigate } from 'react-router-dom'
import { Camera, UserPlus } from 'lucide-react'

export default function Register(){
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const nav = useNavigate()

  async function submit(){
    try {
      await api.post('/auth/register', { username, email, password })
      nav('/login')
    } catch(e){
      setError(e.response?.data?.error || '注册失败')
    }
  }

  return (
    <div className="fade-in" style={{minHeight:'80vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div className="card" style={{width:'100%',maxWidth:360}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
          <Camera size={24} />
          <h2 style={{margin:0}}>注册</h2>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="用户名" />
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="邮箱(可选)" />
          <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="密码" />
          {error && <div style={{color:'var(--color-primary)',fontSize:14}}>{error}</div>}
          <button className="btn btn-primary" onClick={submit}><UserPlus size={16} /> 注册</button>
        </div>
        <div style={{textAlign:'center',marginTop:16,fontSize:14}}>
          已有账号？<Link to="/login" style={{color:'var(--color-primary)'}}>立即登录</Link>
        </div>
      </div>
    </div>
  )
}