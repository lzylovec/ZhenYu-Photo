import React, { useRef, useState, useEffect } from 'react'
import { Image, Upload as IconUpload, Camera, Settings, Tag } from 'lucide-react'
import { api } from '../api'

export default function Upload(){
  const fileRef = useRef(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [camera, setCamera] = useState('')
  const [settings, setSettings] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [previews, setPreviews] = useState([])

  function onDrop(e){
    e.preventDefault()
    const files = e.dataTransfer.files
    fileRef.current.files = files
    updatePreviews(files)
  }

  function updatePreviews(files){
    const arr = Array.from(files || [])
    const urls = arr.map(f => URL.createObjectURL(f))
    setPreviews(urls)
  }

  useEffect(() => {
    return () => {
      previews.forEach(u => URL.revokeObjectURL(u))
    }
  }, [previews])

  const [error, setError] = useState('')
  async function submit(){
    setError('')
    const files = fileRef.current.files
    if (!files || !files.length) { setError('请先选择图片'); return }
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('title', title)
    fd.append('description', description)
    fd.append('camera', camera)
    fd.append('settings', settings)
    fd.append('category', category)
    fd.append('tags', tags)

    try {
      const { data } = await api.post('/photos', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100))
        }
      })
      setResult(data)
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.error || e.message || '上传失败')
    }
  }

  if (!localStorage.getItem('token')) {
    return (
      <div className="fade-in" style={{padding: 'var(--spacing-xl)', textAlign: 'center'}}>
        <div className="card" style={{maxWidth: '400px', margin: '0 auto'}}>
          <div style={{
            fontSize: '18px',
            color: 'var(--color-text)',
            fontWeight: 'var(--font-weight-medium)',
            marginBottom: 'var(--spacing-md)'
          }}>
            仅管理员可上传
          </div>
          <div style={{
            color: 'var(--color-text-light)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            请先登录管理员账户
          </div>
          <a href="/admin-login" className="btn btn-primary">
            前往登录
          </a>
        </div>
      </div>
    )
  }
  
  return (
    <div className="fade-in" style={{padding: 'var(--spacing-xl)', background:'var(--color-hero-bg)'}}>
      {/* 页面标题 */}
      <div style={{
        textAlign: 'center',
        marginBottom: 'var(--spacing-xl)'
      }}>
        <h1 style={{
          fontSize: '36px',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          上传摄影作品
        </h1>
        <p style={{
          fontSize: '16px',
          color: 'var(--color-text-light)',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          分享你的摄影作品，展示你的创意和技术
        </p>
      </div>

      {/* 作品信息表单 */}
      <div className="card" style={{marginBottom: 'var(--spacing-xl)', maxWidth: '800px', margin: '0 auto var(--spacing-xl)'}}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <IconUpload size={24} style={{color: 'var(--color-primary)'}} />
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)'
          }}>
            作品信息
          </h2>
        </div>
        
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)'}}>
          <div style={{position: 'relative'}}>
            <input 
              className="input" 
              placeholder="作品标题 *" 
              value={title} 
              onChange={e=>setTitle(e.target.value)} 
              style={{paddingLeft: '48px'}}
            />
            <IconUpload size={20} style={{position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)'}} />
          </div>
          <div style={{position: 'relative'}}>
            <input 
              className="input" 
              placeholder="拍摄设备" 
              value={camera} 
              onChange={e=>setCamera(e.target.value)} 
              style={{paddingLeft: '48px'}}
            />
            <Camera size={20} style={{position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)'}} />
          </div>
          <div style={{position: 'relative'}}>
            <input 
              className="input" 
              placeholder="拍摄参数 (如: f/2.8, 1/125s, ISO 400)" 
              value={settings} 
              onChange={e=>setSettings(e.target.value)} 
              style={{paddingLeft: '48px'}}
            />
            <Settings size={20} style={{position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)'}} />
          </div>
          <div style={{position: 'relative'}}>
            <input 
              className="input" 
              placeholder="分类 (如: 风景, 人像, 街拍)" 
              value={category} 
              onChange={e=>setCategory(e.target.value)} 
              style={{paddingLeft: '48px'}}
            />
            <Tag size={20} style={{position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)'}} />
          </div>
          <div style={{gridColumn: '1 / -1', position: 'relative'}}>
            <input 
              className="input" 
              placeholder="标签 (用逗号分隔，如: 风景, 日落, 自然)" 
              value={tags} 
              onChange={e=>setTags(e.target.value)} 
              style={{paddingLeft: '48px'}}
            />
            <Tag size={20} style={{position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)'}} />
          </div>
        </div>
        
        <div style={{marginTop: 'var(--spacing-md)'}}>
          <textarea 
            className="input" 
            placeholder="作品描述 (可选，介绍你的创作理念、拍摄故事等)" 
            value={description} 
            onChange={e=>setDescription(e.target.value)} 
            style={{
              width: '100%',
              height: '120px',
              resize: 'vertical',
              minHeight: '80px'
            }} 
          />
        </div>
      </div>

      {/* 文件上传区域 */}
      <div
        className="card"
        onDragOver={e=>e.preventDefault()}
        onDrop={onDrop}
        style={{
          border: '2px dashed var(--color-border)',
          padding: 'var(--spacing-2xl)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'var(--transition)',
          maxWidth: '800px',
          margin: '0 auto var(--spacing-xl)',
          background: 'rgba(52, 152, 219, 0.02)'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--color-accent)';
          e.currentTarget.style.background = 'rgba(52, 152, 219, 0.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--color-border)';
          e.currentTarget.style.background = 'rgba(52, 152, 219, 0.02)';
        }}
      >
        <Image size={64} style={{color: 'var(--color-accent)', margin: '0 auto var(--spacing-md)'}} />
        <div style={{
          fontSize: '18px',
          color: 'var(--color-text)',
          fontWeight: 'var(--font-weight-medium)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          拖拽图片到此处
        </div>
        <div style={{
          fontSize: '14px',
          color: 'var(--color-text-light)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          或点击选择文件
        </div>
        <input type="file" ref={fileRef} multiple accept="image/*" style={{display: 'none'}} onChange={(e)=>updatePreviews(e.target.files)} />
        <button 
          className="btn btn-primary" 
          onClick={()=>fileRef.current?.click()}
          style={{minWidth: '150px'}}
        >
          选择文件
        </button>
      </div>

      {/* 预览区域 */}
      {previews.length > 0 && (
        <div className="card" style={{marginBottom: 'var(--spacing-xl)', maxWidth: '800px', margin: '0 auto var(--spacing-xl)'}}>
          <div style={{
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: '18px',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text)'
          }}>
            待上传预览（{previews.length} 张）
          </div>
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            {previews.map((u, i) => (
              <div key={i} style={{
                position: 'relative',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow)'
              }}>
                <img 
                  src={u} 
                  style={{
                    height: '150px',
                    width: 'auto',
                    display: 'block'
                  }} 
                  alt={`预览 ${i + 1}`}
                />
                <div style={{
                  position: 'absolute',
                  top: 'var(--spacing-xs)',
                  right: 'var(--spacing-xs)',
                  background: 'var(--color-overlay)',
                  color: 'white',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 'var(--font-weight-medium)'
                }}>
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 上传进度 */}
      <div className="card" style={{maxWidth: '800px', margin: '0 auto var(--spacing-xl)'}}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-md)'
        }}>
          <div style={{
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: '16px',
            color: 'var(--color-text)'
          }}>
            上传进度
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--color-text-light)',
            fontWeight: 'var(--font-weight-medium)'
          }}>
            {progress}%
          </div>
        </div>
        
        <div style={{
          height: '8px',
          background: 'var(--color-border)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: 'var(--spacing-md)'
        }}>
          <div style={{
            height: '8px',
            background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
            borderRadius: '4px',
            width: `${progress}%`,
            transition: 'width 0.3s ease'
          }} />
        </div>
        
        {error && (
          <div style={{
            marginBottom: 'var(--spacing-md)',
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
          style={{minWidth: '150px'}}
          disabled={!fileRef.current?.files?.length}
        >
          开始上传
        </button>
      </div>

      {/* 上传结果 */}
      {result && (
        <div className="card" style={{maxWidth: '800px', margin: '0 auto'}}>
          <div style={{
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: '18px',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text)'
          }}>
            上传完成 ✅
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--color-text-light)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            成功上传 {result.items?.length} 张作品
          </div>
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            {result.items?.map((it, i) => (
              <div key={i} style={{
                position: 'relative',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow)'
              }}>
                <img 
                  src={it.thumb_url} 
                  style={{
                    height: '120px',
                    width: 'auto',
                    display: 'block'
                  }} 
                  alt={`上传结果 ${i + 1}`}
                />
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'var(--color-overlay)',
                  color: 'white',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  fontSize: '12px',
                  fontWeight: 'var(--font-weight-medium)',
                  textAlign: 'center'
                }}>
                  {it.title || `作品 ${i + 1}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}