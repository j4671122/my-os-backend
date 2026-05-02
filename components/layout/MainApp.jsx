'use client'
import useStore from '@/store/useStore'
import Sidebar from './Sidebar'
import Header from './Header'
import TaskView    from '@/views/TaskView'
import HomeView    from '@/views/HomeView'
import GoalsView   from '@/views/GoalsView'
import HabitsView  from '@/views/HabitsView'
import DashboardView  from '@/views/DashboardView'
import SearchView     from '@/views/SearchView'
import SettingsView   from '@/views/SettingsView'
import TimeTrackerView from '@/views/TimeTrackerView'
import MemosView      from '@/views/MemosView'
import PomodoroView   from '@/views/PomodoroView'
import RoutineView    from '@/views/RoutineView'
import CommunityView  from '@/views/CommunityView'
import CalendarView        from '@/views/CalendarView'
import NotificationPanel   from '@/components/layout/NotificationPanel'

const VIEWS = {
  today:     TaskView,
  todayonly: TaskView,
  inbox:     TaskView,
  done:      TaskView,
  high:      TaskView,
  home:      HomeView,
  goals:     GoalsView,
  habits:    HabitsView,
  dashboard: DashboardView,
  search:    SearchView,
  settings:  SettingsView,
  time:      TimeTrackerView,
  memo:      MemosView,
  pomodoro:  PomodoroView,
  routine:   RoutineView,
  community: CommunityView,
  calendar:  CalendarView,
}

export default function MainApp() {
  const { currentView, sidebarOpen, setSidebarOpen } = useStore()
  const ViewComponent = VIEWS[currentView] || TaskView

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar />

      <div className="main-area">
        <Header />
        <div className="view-area">
          <ViewComponent />
        </div>
      </div>

      <NotificationPanel />
    </div>
  )
}
