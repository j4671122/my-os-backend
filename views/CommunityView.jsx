'use client'
import { useState, useEffect } from 'react'
import useStore from '@/store/useStore'
import { api } from '@/lib/apiClient'

const GRADS = [
  'linear-gradient(135deg,#2c5f2e,#4a9f4d)',
  'linear-gradient(135deg,#2563eb,#60a5fa)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#d97706,#fbbf24)',
  'linear-gradient(135deg,#dc2626,#f87171)',
]

function Avatar({ avatar, avatarBg, avatarImg, size=34 }) {
  return (
    <div style={{width:size,height:size,borderRadius:'50%',background:avatarImg?'transparent':GRADS[avatarBg||0],display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.44,flexShrink:0,overflow:'hidden'}}>
      {avatarImg
        ? <img src={avatarImg} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        : (avatar||'😊')
      }
    </div>
  )
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60)    return '방금'
  if (diff < 3600)  return `${Math.floor(diff/60)}분 전`
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`
  return `${Math.floor(diff/86400)}일 전`
}

export default function CommunityView() {
  const { communityPosts, setCommunityPosts, settings } = useStore()
  const [loading, setLoading]   = useState(false)
  const [newPost, setNewPost]   = useState('')
  const [posting, setPosting]   = useState(false)
  const [comments, setComments] = useState({})

  useEffect(() => {
    setLoading(true)
    api.get('/api/community')
      .then(data => setCommunityPosts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handlePost(e) {
    e.preventDefault()
    if (!newPost.trim() || posting) return
    setPosting(true)
    try {
      const p = await api.post('/api/community', {
        content:   newPost.trim(),
        author:    settings.name    || '익명',
        handle:    settings.userTag || '',
        avatar:    settings.avatar,
        avatarBg:  settings.avatarBg  || 0,
        avatarImg: settings.avatarImg || '',
      })
      setCommunityPosts([p, ...communityPosts])
      setNewPost('')
    } catch(e) { alert(e.message) }
    finally { setPosting(false) }
  }

  async function toggleLike(post) {
    try {
      const updated = await api.patch(`/api/community?id=${post.id}&action=like`, {})
      setCommunityPosts(communityPosts.map(p => p.id===post.id ? updated : p))
    } catch(e) {}
  }

  function toggleComments(id) {
    setCommunityPosts(communityPosts.map(p => p.id===id ? {...p, showComments:!p.showComments} : p))
  }

  async function handleComment(post) {
    const content = comments[post.id]?.trim()
    if (!content) return
    try {
      const updated = await api.patch(`/api/community?id=${post.id}&action=comment`, {
        content,
        author:    settings.name    || '익명',
        avatar:    settings.avatar,
        avatarBg:  settings.avatarBg  || 0,
        avatarImg: settings.avatarImg || '',
      })
      setCommunityPosts(communityPosts.map(p => p.id===post.id ? {...updated, showComments:true} : p))
      setComments(c => ({...c, [post.id]:''}))
    } catch(e) {}
  }

  async function handleDelete(id) {
    setCommunityPosts(communityPosts.filter(p => p.id!==id))
    await api.del(`/api/community?id=${id}`)
  }

  return (
    <div style={{maxWidth:560,margin:'0 auto'}}>
      <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>💬 커뮤니티</div>

      {/* Compose */}
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:14,marginBottom:16}}>
        <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
          <Avatar avatar={settings.avatar} avatarBg={settings.avatarBg} avatarImg={settings.avatarImg}/>
          <textarea
            placeholder="오늘 어떤 걸 했나요? 공유해보세요… (⌘+Enter 게시)"
            value={newPost}
            onChange={e => setNewPost(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) handlePost(e) }}
            style={{flex:1,border:'none',outline:'none',resize:'none',fontFamily:'inherit',fontSize:13.5,background:'transparent',color:'var(--text)',minHeight:64,lineHeight:1.65}}
          />
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-primary btn-sm" onClick={handlePost} disabled={posting||!newPost.trim()}>
            {posting?'게시 중…':'게시'}
          </button>
        </div>
      </div>

      {loading && <div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>로딩 중…</div>}

      {!loading && communityPosts.length===0 && (
        <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text3)'}}>
          첫 게시물을 작성해보세요 ✨
        </div>
      )}

      {communityPosts.map(post => (
        <div key={post.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:14,marginBottom:10}}>
          <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
            <Avatar avatar={post.avatar} avatarBg={post.avatar_bg||0} avatarImg={post.avatar_img||''}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                <span style={{fontWeight:700,fontSize:13}}>{post.author||'익명'}</span>
                {post.handle && <span style={{fontSize:11,color:'var(--text3)'}}>@{post.handle}</span>}
                <span style={{fontSize:11,color:'var(--text3)',marginLeft:'auto'}}>{timeAgo(post.created_at)}</span>
                {post.isOwn && (
                  <button onClick={() => handleDelete(post.id)}
                    style={{border:'none',background:'none',cursor:'pointer',fontSize:11,color:'var(--text3)',padding:'0 2px'}}>
                    삭제
                  </button>
                )}
              </div>
              <div style={{fontSize:13.5,lineHeight:1.65,whiteSpace:'pre-wrap',color:'var(--text)',marginBottom:10}}>
                {post.content}
              </div>
              <div style={{display:'flex',gap:14,alignItems:'center'}}>
                <button onClick={() => toggleLike(post)}
                  style={{border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:12.5,color:post.liked?'var(--red)':'var(--text3)',fontWeight:post.liked?700:400,padding:0}}>
                  {post.liked?'❤️':'🤍'} {post.likes||0}
                </button>
                <button onClick={() => toggleComments(post.id)}
                  style={{border:'none',background:'none',cursor:'pointer',fontSize:12.5,color:'var(--text3)',display:'flex',alignItems:'center',gap:4,padding:0}}>
                  💬 {(post.comments||[]).length}
                </button>
              </div>
            </div>
          </div>

          {post.showComments && (
            <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}}>
              {(post.comments||[]).map(c => (
                <div key={c.id} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:8}}>
                  <Avatar avatar={c.avatar} avatarBg={c.avatar_bg||0} avatarImg={c.avatar_img||''} size={26}/>
                  <div style={{flex:1,background:'var(--surface2)',borderRadius:10,padding:'6px 10px'}}>
                    <span style={{fontWeight:700,fontSize:11.5,marginRight:6}}>{c.author}</span>
                    <span style={{fontSize:12.5,color:'var(--text)'}}>{c.content}</span>
                  </div>
                </div>
              ))}
              <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
                <Avatar avatar={settings.avatar} avatarBg={settings.avatarBg||0} avatarImg={settings.avatarImg||''} size={26}/>
                <input
                  value={comments[post.id]||''}
                  onChange={e => setComments(c => ({...c,[post.id]:e.target.value}))}
                  onKeyDown={e => e.key==='Enter' && handleComment(post)}
                  placeholder="댓글 달기…"
                  style={{flex:1,border:'1px solid var(--border)',borderRadius:20,padding:'5px 12px',fontSize:12.5,outline:'none',fontFamily:'inherit',background:'var(--surface)',color:'var(--text)'}}
                />
                <button className="btn btn-primary btn-sm" style={{borderRadius:20,padding:'4px 12px',flexShrink:0}} onClick={() => handleComment(post)}>
                  게시
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
