import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api'

export default function AdminHomeVideos(){
  const fileRef = useRef(null)
  const [items, setItems] = useState([])
  const [previews, setPreviews] = useState([])
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  async function load(){
    try {
      const { data } = await api.get('/admin/home-videos')
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      setItems([])
    }
  }
  useEffect(()=>{ load() },[])

  function onFilesChange(files){
    const arr = Array.from(files || [])
    setError('')
    setPreviews(arr.map(f => ({ name: f.name, url: URL.createObjectURL(f), file: f })))
  }

  async function uploadAll(){
    setError('')
    setProgress(0)
    for (let i = 0; i < previews.length; i++){
      const f = previews[i].file
      const name = previews[i].name
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', (api.defaults.baseURL || '') + '/admin/home-videos')
        const token = localStorage.getItem('token')
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        const fd = new FormData()
        fd.append('file', f)
        fd.append('title', name)
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100))
        }
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              const res = (()=>{ try { return JSON.parse(xhr.responseText) } catch { return {} } })()
              reject(new Error(res.detail || '上传失败'))
            }
          }
        }
        xhr.onerror = () => reject(new Error('网络错误'))
        const csrf = localStorage.getItem('csrf')
        if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf)
        xhr.send(fd)
      })
    }
    setPreviews([])
    await load()
  }

  async function remove(id){
    if (!window.confirm('确定要删除该视频吗？此操作不可恢复')) return
    try {
      await api.delete(`/admin/home-videos/${id}`)
      await load()
    } catch(e){
      setError(e.response?.data?.detail || e.response?.data?.error || e.message || '删除失败')
    }
  }

  if (!localStorage.getItem('token')){
    return (
      <div className="fade-in" style={{padding: 'var(--spacing-xl)', textAlign: 'center'}}>
        仅超级管理员可访问
      </div>
    )
  }

  return (
    <div className="fade-in" style={{padding: 'var(--spacing-xl)'}}>
      <div className="card" style={{maxWidth: 1000, margin: '0 auto var(--spacing-xl)'}}>
        <div style={{fontSize: '24px', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)'}}>首页视频管理</div>
        <div style={{color: 'var(--color-text-light)', marginBottom: 'var(--spacing-md)'}}>支持 MP4 等常见格式；建议 1080p，时长适中</div>
        <input type="file" ref={fileRef} multiple accept="video/*" style={{display: 'none'}} onChange={e=>onFilesChange(e.target.files)} />
        <button className="btn btn-primary" onClick={()=>fileRef.current?.click()} style={{marginRight: 'var(--spacing-md)'}}>选择视频</button>
        <button className="btn" onClick={uploadAll} disabled={!previews.length}>开始上传</button>
        {error && <div style={{color:'var(--color-secondary)', marginTop:'var(--spacing-md)'}}>{error}</div>}
        <div style={{marginTop:'var(--spacing-md)'}}>
          <div style={{height:8,background:'var(--color-border)',borderRadius:4,overflow:'hidden'}}>
            <div style={{height:8,background:'linear-gradient(90deg,var(--color-primary),var(--color-accent))',width:`${progress}%`,transition:'width .3s ease'}} />
          </div>
          <div style={{marginTop:8,color:'var(--color-text-light)'}}>{progress}%</div>
        </div>
        {!!previews.length && (
          <div style={{marginTop: 'var(--spacing-lg)'}}>
            <div style={{fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-sm)'}}>待上传（{previews.length}）</div>
            <div style={{display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap'}}>
              {previews.map((p, i) => (
                <div key={i} className="card" style={{padding: 'var(--spacing-sm)', width: 240}}>
                  <video src={p.url} style={{width: '100%', display:'block'}} muted controls />
                  <div style={{fontSize: 12, color:'var(--color-text-light)', marginTop: 8}}>{p.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{maxWidth: 1000, margin: '0 auto'}}>
        <div style={{display: 'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 'var(--spacing-md)'}}>
          <div style={{fontWeight: 'var(--font-weight-semibold)'}}>已上传（{items.length}）</div>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--spacing-md)'}}>
          {items.map((it) => (
            <div key={it.id} className="card" style={{position:'relative'}}>
              <video src={it.video_url} style={{width:'100%', display:'block'}} controls muted />
              <div style={{display:'flex', justifyContent:'space-between', gap:'var(--spacing-sm)', marginTop:'var(--spacing-sm)'}}>
                <div style={{color:'var(--color-text-light)'}}>{it.title || '首页视频'}</div>
                <button className="btn" onClick={()=>remove(it.id)} style={{color:'var(--color-secondary)'}}>删除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}