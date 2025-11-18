import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { User, Camera, Heart, Bookmark, Lock, Pencil } from 'lucide-react'
import { api } from '../api'

export default function Profile(){
  const [me, setMe] = useState(null)
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [newName, setNewName] = useState('')
  const [nameMsg, setNameMsg] = useState('')

  async function load(){
    setLoading(true)
    setErr('')
    try {
      const [meRes, listRes, statsRes] = await Promise.all([
        api.get('/users/me'),
        api.get('/users/me/photos'),
        api.get('/users/me/stats'),
      ])
      setMe(meRes.data)
      setItems(listRes.data)
      setStats(statsRes.data)
    } catch(e){
      setErr(e.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(()=>{ load() },[])

  return (
    <div className="fade-in" style={{padding:24, background:'var(--color-hero-bg)'}}>
      <div className="card" style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:60,height:60,background:'var(--color-primary)',color:'#fff',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
            <User size={28} />
          </div>
          <div>
            <div style={{fontSize:20,fontWeight:600}}>{me?.username}</div>
            <div style={{color:'var(--color-muted)',fontSize:14}}>加入于 {me?.created_at?.slice(0,10)}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginTop:24}}>
          <div className="card" style={{textAlign:'center',padding:16}}>
            <div style={{fontSize:24,fontWeight:600,color:'var(--color-primary)'}}>{stats?.photos ?? 0}</div>
            <div style={{color:'var(--color-muted)',fontSize:14}}>作品</div>
          </div>
          <div className="card" style={{textAlign:'center',padding:16}}>
            <div style={{fontSize:24,fontWeight:600,color:'var(--color-primary)'}}>{stats?.likes ?? 0}</div>
            <div style={{color:'var(--color-muted)',fontSize:14}}>点赞</div>
          </div>
          <div className="card" style={{textAlign:'center',padding:16}}>
            <div style={{fontSize:24,fontWeight:600,color:'var(--color-primary)'}}>{stats?.favorites ?? 0}</div>
            <div style={{color:'var(--color-muted)',fontSize:14}}>收藏</div>
          </div>
        </div>
      </div>

      <div className="card" style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
          <Lock size={20} />
          <h3 style={{margin:0}}>修改密码</h3>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <input className="input" type="password" placeholder="原密码" value={oldPwd} onChange={e=>setOldPwd(e.target.value)} />
          <input className="input" type="password" placeholder="新密码(≥6位)" value={newPwd} onChange={e=>setNewPwd(e.target.value)} />
        </div>
        {pwdMsg && <div style={{marginTop:12,color:'var(--color-text-light)'}}>{pwdMsg}</div>}
        <button 
          className="btn btn-primary" 
          style={{marginTop:12}}
          onClick={async ()=>{
            setPwdMsg('')
            try {
              const { data } = await api.post('/auth/change-password', { old_password: oldPwd, new_password: newPwd })
              if (data.ok) {
                setPwdMsg('密码已更新')
                setOldPwd(''); setNewPwd('')
              }
            } catch(e){
              const msg = e.response?.data?.detail || e.response?.data?.error || e.message
              setPwdMsg(msg ? String(msg) : '更新失败')
            }
          }}
        >
          保存
        </button>
      </div>

      <div className="card" style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
          <Pencil size={20} />
          <h3 style={{margin:0}}>修改用户名</h3>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
          <input className="input" placeholder="新用户名(3-64，支持中文/字母/数字/_/-)" value={newName} onChange={e=>setNewName(e.target.value)} />
        </div>
        {nameMsg && <div style={{marginTop:12,color:'var(--color-text-light)'}}>{nameMsg}</div>}
        <button 
          className="btn btn-primary" 
          style={{marginTop:12}}
          onClick={async ()=>{
            setNameMsg('')
            try {
              const { data } = await api.post('/users/change-username', { new_username: newName })
              if (data.ok) {
                setNameMsg('用户名已更新为 ' + data.username)
                setNewName('')
                const meRes = await api.get('/users/me')
                setMe(meRes.data)
              }
            } catch(e){
              setNameMsg(e.response?.data?.error || '更新失败')
            }
          }}
        >
          保存
        </button>
      </div>

      <div className="card">
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
          <Camera size={20} />
          <h3 style={{margin:0}}>我的作品</h3>
        </div>
        {loading ? (
          <div style={{padding:24,textAlign:'center',color:'var(--color-text-light)'}}>正在加载我的作品...</div>
        ) : items.length === 0 ? (
          <div style={{padding:24,textAlign:'center',color:'var(--color-text-light)'}}>暂无作品</div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16}}>
            {items.map(it => (
              <ItemCard key={it.id} it={it} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ItemCard({ it, onChanged }){
  const [detail, setDetail] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [opening, setOpening] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ title:'', description:'', camera:'', settings:'', category:'', tags:'' })

  useEffect(()=>{
    if (showEdit) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [showEdit])

  async function open(){
    setMsg('')
    if (opening) return
    setOpening(true)
    setShowEdit(true)
    setLoadingDetail(true)
    try {
      const { data } = await api.get(`/photos/${it.id}`)
      setDetail(data)
      setForm({
        title: data.title || '',
        description: data.description || '',
        camera: data.camera || '',
        settings: data.settings || '',
        category: data.category || '',
        tags: (data.tags || []).join(',')
      })
    } catch(e){
      const m = e.response?.data?.detail || e.response?.data?.error || e.message
      setMsg(m || '加载失败')
    } finally {
      setLoadingDetail(false)
      setOpening(false)
    }
  }

  async function save(){
    setSaving(true)
    setMsg('')
    try {
      await api.put(`/photos/${it.id}`, form)
      setShowEdit(false)
      onChanged?.()
    } catch(e){
      const m = e.response?.data?.detail || e.response?.data?.error || e.message
      setMsg(m || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove(){
    if (!window.confirm('确定要删除该作品吗？此操作不可恢复')) return
    setMsg('')
    try {
      await api.delete(`/photos/${it.id}`)
      onChanged?.()
    } catch(e){
      const m = e.response?.data?.detail || e.response?.data?.error || e.message
      setMsg(m || '删除失败')
    }
  }

  return (
    <div className="card" style={{padding:12}}>
      <img
        src={it.thumb_url}
        srcSet={`${it.thumb_url} 480w, ${it.image_url || it.thumb_url} 2000w`}
        sizes="(max-width:480px) 100vw, (max-width:768px) 50vw, 25vw"
        loading="lazy"
        alt={it.title}
        style={{width:'100%',borderRadius:8}}
      />
      <div style={{marginTop:8,fontSize:14,fontWeight:500}}>{it.title}</div>
      <div style={{color:'var(--color-muted)',fontSize:12,marginTop:4}}>{it.created_at?.slice(0,10)}</div>
      <div style={{display:'flex',gap:8,marginTop:8}}>
        <button className="btn" onClick={open} disabled={opening || showEdit}>编辑</button>
        <button className="btn" onClick={remove} style={{color:'var(--color-secondary)'}}>删除</button>
      </div>
      {msg && <div style={{marginTop:8,color:'var(--color-text-light)'}}>{msg}</div>}

      {showEdit && createPortal(
        <div onMouseDown={()=>setShowEdit(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div onMouseDown={e=>e.stopPropagation()} className="card no-hover" style={{width:'95%',maxWidth:600}}>
            <div style={{fontWeight:600,fontSize:18,marginBottom:12}}>编辑作品</div>
            {loadingDetail ? (
              <div style={{padding:16,color:'var(--color-text-light)'}}>正在加载作品详情...</div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <input className="input" placeholder="标题" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
                <input className="input" placeholder="分类" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} />
                <input className="input" placeholder="拍摄设备" value={form.camera} onChange={e=>setForm(f=>({...f,camera:e.target.value}))} />
                <input className="input" placeholder="拍摄参数" value={form.settings} onChange={e=>setForm(f=>({...f,settings:e.target.value}))} />
                <input className="input" placeholder="标签(逗号分隔)" value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} style={{gridColumn:'1 / -1'}} />
                <textarea className="input" placeholder="描述" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{gridColumn:'1 / -1',height:120}} />
              </div>
            )}
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
              <button className="btn" onClick={()=>setShowEdit(false)}>取消</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || loadingDetail}>{saving?'保存中...':'保存'}</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  )
}