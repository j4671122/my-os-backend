/**
 * /api/resources
 * GET                               → 내 폴더 + 자료 전체
 * POST ?type=folder                 → 폴더 생성 {name, color, parentId}
 * POST ?type=item                   → 자료 생성 {folderId, type, title, content, url, tags}
 * PUT  ?id=&itemType=folder         → 폴더 수정
 * PUT  ?id=&itemType=item           → 자료 수정
 * DELETE ?id=&itemType=folder       → 폴더 삭제 (cascade)
 * DELETE ?id=&itemType=item         → 자료 삭제
 */
import supabase from './_lib/supabase.js'
import { withCors, getUserId } from './_lib/cors.js'
import { getAuthUser } from './_lib/auth.js'

export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  const uid = getUserId(req)
  const { id, type, itemType } = req.query

  // GET → 내 폴더 + 자료
  if (req.method === 'GET') {
    const [{ data: folders, error: fe }, { data: items, error: ie }] = await Promise.all([
      supabase.from('resource_folders').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
      supabase.from('resources').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    ])
    if (fe) return res.status(500).json({ error: fe.message })
    if (ie) return res.status(500).json({ error: ie.message })
    return res.json({ folders: folders || [], items: items || [] })
  }

  // POST → 생성
  if (req.method === 'POST') {
    if (type === 'folder') {
      const { name, color, parentId } = req.body || {}
      if (!name?.trim()) return res.status(400).json({ error: 'name required' })
      const { data, error } = await supabase
        .from('resource_folders')
        .insert({
          user_id: uid,
          name: name.trim(),
          color: color || '#6b7280',
          parent_id: parentId || null,
        })
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(data)
    }

    if (type === 'item') {
      const { folderId, type: itemTypeBody, title, content, url, tags } = req.body || {}
      if (!title?.trim()) return res.status(400).json({ error: 'title required' })
      const { data, error } = await supabase
        .from('resources')
        .insert({
          user_id: uid,
          folder_id: folderId || null,
          type: itemTypeBody || 'note',
          title: title.trim(),
          content: content?.trim() || '',
          url: url?.trim() || '',
          tags: tags || [],
        })
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(data)
    }

    return res.status(400).json({ error: 'type (folder|item) required' })
  }

  // PUT → 수정
  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const body = req.body || {}

    if (itemType === 'folder') {
      const updates = {}
      if (body.name) updates.name = body.name.trim()
      if (body.color) updates.color = body.color
      if ('parentId' in body) updates.parent_id = body.parentId || null
      const { data, error } = await supabase
        .from('resource_folders')
        .update(updates)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }

    if (itemType === 'item') {
      const updates = {}
      if (body.title) updates.title = body.title.trim()
      if ('content' in body) updates.content = body.content?.trim() || ''
      if ('url' in body) updates.url = body.url?.trim() || ''
      if ('tags' in body) updates.tags = body.tags || []
      if ('folderId' in body) updates.folder_id = body.folderId || null
      if ('type' in body) updates.type = body.type
      const { data, error } = await supabase
        .from('resources')
        .update(updates)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }

    return res.status(400).json({ error: 'itemType (folder|item) required' })
  }

  // DELETE → 삭제
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id required' })

    if (itemType === 'folder') {
      // 폴더 안의 자료 먼저 삭제 (cascade)
      await supabase.from('resources').delete().eq('folder_id', id).eq('user_id', uid)
      const { error } = await supabase
        .from('resource_folders')
        .delete()
        .eq('id', id)
        .eq('user_id', uid)
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ success: true })
    }

    if (itemType === 'item') {
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id)
        .eq('user_id', uid)
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ success: true })
    }

    return res.status(400).json({ error: 'itemType (folder|item) required' })
  }

  res.status(405).json({ error: 'Method not allowed' })
})
