'use client'
import { create } from 'zustand'

const DEFAULT_SETTINGS = {
  name: '', goal: '', userTag: '',
  avatar: '😊', bio: '', avatarImg: '', avatarBg: 0, avatarBgGrad: null,
  lang: 'ko', aiPersonality: 'default', permission: 'user',
  joinedAt: null, notifEnabled: true, notifCoach: true, notifOverdue: true,
  weekStart: 1, defaultPriority: 'med', showDoneInToday: false, theme: 'light',
  settingsTab: 'profile', currentView: 'today',
  folderOrder: [], goalOrder: [],
  homeWidgets: [],
  timeTrackerLabels: [], timeTrackerData: {}, timeTrackerSelectedLabel: 'study',
  overdueColor: '#dc2626', upcomingColor: '#2563eb',
  memos: [], userBadges: [], routines: [], goalParentMap: {},
}

const useStore = create((set, get) => ({
  // ── 인증 ─────────────────────────────────────────────────
  user:        null,
  token:       null,
  profile:     null,
  isGuest:     false,
  authReady:   false,
  showOnboarding: false,

  // ── 데이터 ───────────────────────────────────────────────
  tasks:         [],
  goals:         [],
  folders:       [],
  habits:        [],
  events:        [],
  notifications: [],
  communityPosts: [],

  // ── 설정 ─────────────────────────────────────────────────
  settings: { ...DEFAULT_SETTINGS },

  // ── UI 상태 ──────────────────────────────────────────────
  currentView:     'today',
  selectedTaskId:  null,
  sidebarOpen:     false,
  notifPanelOpen:  false,
  openTaskIds:     [],

  // ── 인증 액션 ─────────────────────────────────────────────
  setUser:      (user, token)  => set({ user, token }),
  setToken:     (token)        => set({ token }),
  setProfile:   (profile)      => set({ profile }),
  setAuthReady: (authReady)    => set({ authReady }),
  setShowOnboarding: (v)       => set({ showOnboarding: v }),

  clearAuth: () => set({
    user: null, token: null, profile: null, isGuest: false,
    tasks: [], goals: [], folders: [], habits: [],
    events: [], notifications: [], communityPosts: [],
    settings: { ...DEFAULT_SETTINGS },
    currentView: 'today',
  }),

  signInAsGuest: () => set({
    isGuest: true, user: null, token: null,
    settings: {
      ...DEFAULT_SETTINGS,
      name: '게스트', userTag: 'guest', avatar: '👤',
    },
    tasks: [{
      id: 'guest-1', title: '(게스트) 앱 살펴보기 — 로그인하면 데이터가 저장돼요!',
      done: false, priority: 'high', folderId: null, goalId: null,
      dueDate: new Date().toISOString().slice(0, 10),
      notes: '게스트 모드: 새로고침 시 데이터가 사라집니다.',
      tags: ['공부'], subtasks: [], links: [],
    }],
    currentView: 'today',
  }),

  // ── 서버 데이터 로드 ──────────────────────────────────────
  loadFromServer: async (token) => {
    try {
      const h = { Authorization: `Bearer ${token}` }
      const [tasks, goals, folders, habits, profile] = await Promise.all([
        fetch('/api/tasks',   { headers: h }).then(r => r.json()),
        fetch('/api/goals',   { headers: h }).then(r => r.json()),
        fetch('/api/folders', { headers: h }).then(r => r.json()),
        fetch('/api/habits',  { headers: h }).then(r => r.json()),
        fetch('/api/profile', { headers: h }).then(r => r.json()),
      ])
      set({
        tasks:   Array.isArray(tasks)   ? tasks   : [],
        goals:   Array.isArray(goals)   ? goals   : [],
        folders: Array.isArray(folders) ? folders : [],
        habits:  Array.isArray(habits)  ? habits  : [],
      })
      if (profile) {
        set({ profile })
        const prefs = profile.preferences || {}
        set(s => ({ settings: { ...s.settings, ...prefs,
          name:        profile.display_name || '',
          userTag:     profile.user_tag     || '',
          avatar:      profile.avatar       || '😊',
          avatarImg:   profile.avatar_img   || '',
          bio:         profile.bio          || '',
          permission:  profile.permission   || 'user',
          aiPersonality: profile.ai_personality || 'default',
        }}))
        if (!profile.user_tag) set({ showOnboarding: true })
      }
    } catch (e) {
      console.error('[loadFromServer]', e.message)
    }
  },

  // ── 할일 액션 ─────────────────────────────────────────────
  setTasks:    (tasks)          => set({ tasks }),
  addTask:     (task)           => set(s => ({ tasks: [task, ...s.tasks] })),
  updateTask:  (id, fields)     => set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...fields } : t) })),
  removeTask:  (id)             => set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),

  // ── 목표 액션 ─────────────────────────────────────────────
  setGoals:    (goals)          => set({ goals }),
  addGoal:     (goal)           => set(s => ({ goals: [goal, ...s.goals] })),
  updateGoal:  (id, fields)     => set(s => ({ goals: s.goals.map(g => g.id === id ? { ...g, ...fields } : g) })),
  removeGoal:  (id)             => set(s => ({ goals: s.goals.filter(g => g.id !== id) })),

  // ── 폴더 액션 ─────────────────────────────────────────────
  setFolders:  (folders)        => set({ folders }),
  addFolder:   (folder)         => set(s => ({ folders: [...s.folders, folder] })),
  updateFolder:(id, fields)     => set(s => ({ folders: s.folders.map(f => f.id === id ? { ...f, ...fields } : f) })),
  removeFolder:(id)             => set(s => ({ folders: s.folders.filter(f => f.id !== id) })),

  // ── 습관 액션 ─────────────────────────────────────────────
  setHabits:   (habits)         => set({ habits }),
  addHabit:    (habit)          => set(s => ({ habits: [...s.habits, habit] })),
  updateHabit: (id, fields)     => set(s => ({ habits: s.habits.map(h => h.id === id ? { ...h, ...fields } : h) })),
  removeHabit: (id)             => set(s => ({ habits: s.habits.filter(h => h.id !== id) })),

  // ── 커뮤니티 ─────────────────────────────────────────────
  setCommunityPosts: (posts)    => set({ communityPosts: posts }),

  // ── UI 액션 ──────────────────────────────────────────────
  setCurrentView:   (view)      => set({ currentView: view }),
  setSelectedTask:  (id)        => set({ selectedTaskId: id }),
  toggleSidebar:    ()          => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen:   (v)         => set({ sidebarOpen: v }),
  toggleNotifPanel: ()          => set(s => ({ notifPanelOpen: !s.notifPanelOpen })),

  // ── 설정 액션 ────────────────────────────────────────────
  setSetting:  (key, val)       => set(s => ({ settings: { ...s.settings, [key]: val } })),
  setSettings: (patch)          => set(s => ({ settings: { ...s.settings, ...patch } })),

  // ── 알림 액션 ────────────────────────────────────────────
  setNotifications:   (n)           => set({ notifications: n }),
  pushNotification:   (msg, type='info') => set(s => ({
    notifications: [...(s.notifications||[]), {
      id:   Date.now().toString(36) + Math.random().toString(36).slice(2,5),
      msg, type, time: Date.now(), read: false,
    }]
  })),
  markNotifRead:      (id)          => set(s => ({
    notifications: s.notifications.map(n => n.id===id ? {...n, read:true} : n)
  })),
  clearNotifications: ()            => set({ notifications: [] }),
}))

export default useStore
