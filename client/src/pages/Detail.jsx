import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Heart, Bookmark, MessageCircle, Send, Camera, Settings } from 'lucide-react'
import { api } from '../api'

export default function Detail(){
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [comment, setComment] = useState('')

  async function load(){
    const { data } = await api.get(`/photos/${id}`)
    setData(data)
  }
  useEffect(()=>{ load() },[id])

  const authed = !!localStorage.getItem('token')
  async function like(){ if(!authed) return; await api.post(`/photos/${id}/like`); load() }
  async function fav(){ if(!authed) return; await api.post(`/photos/${id}/favorite`); load() }
  async function sendComment(){ if(!authed || !comment) return; await api.post(`/photos/${id}/comment`, { content: comment }); setComment(''); load() }

  if (!data) return <div className="fade-in" style={{padding: 'var(--spacing-xl)', textAlign: 'center'}}>加载中...</div>

  return (
    <div className="fade-in" style={{padding: 0}}>
      {/* 大图展示区域 */}
      <div style={{
        background: 'var(--color-bg)',
        padding: 'var(--spacing-xl)',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          background: 'white',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <img 
            src={data.image_url} 
            alt={data.title} 
            style={{
              width: '100%', 
              height: 'auto',
              maxHeight: '80vh',
              objectFit: 'contain',
              display: 'block'
            }} 
          />
        </div>
      </div>

      {/* 照片信息区域 */}
      <div style={{padding: 'var(--spacing-xl)'}}>
        <div style={{maxWidth: '1200px', margin: '0 auto'}}>
          <div className="card" style={{marginBottom: 'var(--spacing-xl)'}}>
            {/* 标题和操作区 */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-lg)',
              flexWrap: 'wrap',
              gap: 'var(--spacing-md)'
            }}>
              <div style={{flex: 1, minWidth: '300px'}}>
                <h1 style={{
                  margin: '0 0 var(--spacing-sm) 0',
                  fontSize: '32px',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-text)',
                  lineHeight: 1.2
                }}>
                  {data.title}
                </h1>
                <div style={{
                  color: 'var(--color-text-light)',
                  fontSize: '16px',
                  fontWeight: 'var(--font-weight-medium)'
                }}>
                  摄影师：{data.author}
                </div>
              </div>
              
              {authed && (
                <div style={{display: 'flex', gap: 'var(--spacing-sm)'}}>
                  <button 
                    className="btn" 
                    onClick={like}
                    style={{
                      background: 'rgba(231, 76, 60, 0.1)',
                      borderColor: 'rgba(231, 76, 60, 0.2)',
                      color: 'var(--color-secondary)'
                    }}
                  >
                    <Heart size={18} /> {data.likes}
                  </button>
                  <button 
                    className="btn" 
                    onClick={fav}
                    style={{
                      background: 'rgba(52, 152, 219, 0.1)',
                      borderColor: 'rgba(52, 152, 219, 0.2)',
                      color: 'var(--color-accent)'
                    }}
                  >
                    <Bookmark size={18} /> {data.favorites}
                  </button>
                </div>
              )}
            </div>

            {/* 技术信息 */}
            <div style={{
              display: 'flex',
              gap: 'var(--spacing-xl)',
              marginBottom: 'var(--spacing-lg)',
              flexWrap: 'wrap'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)'}}>
                <Camera size={20} style={{color: 'var(--color-muted)'}} />
                <span style={{fontSize: '15px', color: 'var(--color-text)'}}>
                  {data.camera || '未指定相机'}
                </span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)'}}>
                <Settings size={20} style={{color: 'var(--color-muted)'}} />
                <span style={{fontSize: '15px', color: 'var(--color-text)'}}>
                  {data.settings || '未指定参数'}
                </span>
              </div>
            </div>

            {/* 标签 */}
            {data.tags?.length ? (
              <div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-sm)',
                  color: 'var(--color-text)'
                }}>
                  标签
                </div>
                <div style={{display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap'}}>
                  {data.tags.map(t => (
                    <span 
                      key={t} 
                      style={{
                        background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
                        color: 'white',
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px',
                        fontWeight: 'var(--font-weight-medium)',
                        boxShadow: 'var(--shadow)'
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* 评论区 */}
          {authed && (
            <div className="card" style={{marginBottom: 'var(--spacing-lg)'}}>
              <h3 style={{
                margin: '0 0 var(--spacing-md) 0',
                fontSize: '20px',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text)'
              }}>
                发表评论
              </h3>
              <div style={{display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-md)'}}>
                <input 
                  className="input" 
                  value={comment} 
                  onChange={e=>setComment(e.target.value)} 
                  placeholder="分享你对这张照片的看法..." 
                  style={{flex: 1}} 
                />
                <button 
                  className="btn btn-primary" 
                  onClick={sendComment}
                  style={{minWidth: '100px'}}
                >
                  <Send size={16} /> 发布
                </button>
              </div>
            </div>
          )}

          {/* 评论列表 */}
          {(data.comments||[]).length > 0 && (
            <div className="card">
              <h3 style={{
                margin: '0 0 var(--spacing-lg) 0',
                fontSize: '20px',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text)'
              }}>
                评论 ({data.comments.length})
              </h3>
              <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                {(data.comments||[]).map(c => (
                  <li 
                    key={c.id} 
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      paddingBottom: 'var(--spacing-md)',
                      marginBottom: 'var(--spacing-md)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'var(--font-weight-bold)',
                        fontSize: '16px'
                      }}>
                        {c.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{
                          fontWeight: 'var(--font-weight-semibold)',
                          fontSize: '15px',
                          color: 'var(--color-text)'
                        }}>
                          {c.username}
                        </div>
                        <div style={{
                          color: 'var(--color-text-light)',
                          fontSize: '13px'
                        }}>
                          {new Date(c.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      marginLeft: '48px',
                      color: 'var(--color-text)',
                      fontSize: '15px',
                      lineHeight: 1.6
                    }}>
                      {c.content}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}