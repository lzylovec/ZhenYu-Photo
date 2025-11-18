import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api'

export default function AdminCarousel(){
  const fileRef = useRef(null)
  const [items, setItems] = useState([])
  const [previews, setPreviews] = useState([])
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  async function load(){
    try {
      const { data } = await api.get('/admin/carousel')
      setItems(data)
    } catch (e) {
      setItems([])
    }
  }
  useEffect(()=>{ load() },[])

  function onFilesChange(files){
    const arr = Array.from(files || []).slice(0, 9 - items.length)
    setError('')
    setPreviews(arr.map(f => ({ name: f.name, url: URL.createObjectURL(f), file: f })))
  }

  async function uploadAll(){
    setError('')
    setProgress(0)
    for (let i = 0; i < previews.length; i++){
      const f = previews[i].file
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', (api.defaults.baseURL || '') + '/admin/carousel')
        const token = localStorage.getItem('token')
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        const fd = new FormData()
        fd.append('file', f)
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100))
        }
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              reject(new Error(xhr.responseText || '上传失败'))
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

  function move(idx, dir){
    const newItems = items.slice()
    const swap = idx + dir
    if (swap < 0 || swap >= newItems.length) return
    const t = newItems[idx]
    newItems[idx] = newItems[swap]
    newItems[swap] = t
    setItems(newItems)
  }

  async function saveOrder(){
    const ids = items.map(it => it.id)
    await api.put('/admin/carousel/sort', { ids })
    await load()
  }

  async function remove(id){
    await api.delete(`/admin/carousel/${id}`)
    await load()
  }

  async function replace(id, file){
    const fd = new FormData()
    fd.append('file', file)
    const token = localStorage.getItem('token')
    const csrf = localStorage.getItem('csrf')
    await fetch((api.defaults.baseURL || '') + `/admin/carousel/${id}`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf || '' } : { 'X-CSRF-Token': csrf || '' },
      body: fd
    })
    await load()
  }

  if (!localStorage.getItem('token')){
    return (
      <div className="fade-in" style={{padding: 'var(--spacing-xl)', textAlign: 'center'}}>
        仅管理员可访问
      </div>
    )
  }

  return (
    <div className="fade-in" style={{padding: 'var(--spacing-xl)'}}>
      <div className="card" style={{maxWidth: 1000, margin: '0 auto var(--spacing-xl)'}}>
        <div style={{fontSize: '24px', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)'}}>首页轮播图管理</div>
        <div style={{color: 'var(--color-text-light)', marginBottom: 'var(--spacing-md)'}}>最多上传9张，推荐尺寸1920×800px</div>
        <input type="file" ref={fileRef} multiple accept="image/*" style={{display: 'none'}} onChange={e=>onFilesChange(e.target.files)} />
        <button className="btn btn-primary" onClick={()=>fileRef.current?.click()} style={{marginRight: 'var(--spacing-md)'}}>选择图片</button>
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
            <div style={{fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-sm)'}}>待上传预览（{previews.length}）</div>
            <div style={{display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap'}}>
              {previews.map((p, i) => (
                <div key={i} className="card" style={{padding: 'var(--spacing-sm)'}}>
                  <img src={p.url} alt={p.name} style={{height: 120, display:'block'}} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{maxWidth: 1000, margin: '0 auto'}}>
        <div style={{display: 'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 'var(--spacing-md)'}}>
          <div style={{fontWeight: 'var(--font-weight-semibold)'}}>已上传（{items.length}）</div>
          <button className="btn btn-primary" onClick={saveOrder}>保存排序</button>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--spacing-md)'}}>
          {items.map((it, i) => (
            <div key={it.id} className="card" style={{position:'relative'}}>
              <img src={it.thumb_url || it.image_url} alt={it.id} style={{width:'100%', display:'block'}} />
              <div style={{display:'flex', justifyContent:'space-between', gap:'var(--spacing-sm)', marginTop:'var(--spacing-sm)'}}>
                <div style={{display:'flex', gap:'var(--spacing-sm)'}}>
                  <button className="btn" onClick={()=>move(i, -1)}>上移</button>
                  <button className="btn" onClick={()=>move(i, 1)}>下移</button>
                </div>
                <div style={{display:'flex', gap:'var(--spacing-sm)'}}>
                  <label className="btn">
                    替换
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0] && replace(it.id, e.target.files[0])} />
                  </label>
                  <button className="btn" onClick={()=>remove(it.id)} style={{color:'var(--color-secondary)'}}>删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}