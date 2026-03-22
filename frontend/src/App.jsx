import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import TeacherLayout from './layouts/TeacherLayout'
import StudentLayout from './layouts/StudentLayout'

// Teacher pages
import TeacherDashboard    from './pages/teacher/Dashboard'
import Analytics           from './pages/teacher/Analytics'
import MyClasses           from './pages/teacher/MyClasses'
import MarkAttendance      from './pages/teacher/MarkAttendance'
import MarksEntry          from './pages/teacher/MarksEntry'
import TeacherAssignments  from './pages/teacher/Assignments'
import TeacherAnnouncements from './pages/teacher/Announcements'
import TeacherNotes        from './pages/teacher/Notes'
import AITools             from './pages/teacher/AITools'
import QuestionPaper       from './pages/teacher/QuestionPaper'
import TeacherTimetable    from './pages/teacher/Timetable'
import TeacherAvailability from './pages/teacher/Availability'
import TeacherProfile      from './pages/teacher/Profile'
import ProgressReport      from './pages/teacher/ProgressReport'

// Student pages
import StudentDashboard   from './pages/student/Dashboard'
import StudentAttendance  from './pages/student/Attendance'
import StudentAssignments from './pages/student/Assignments'
import StudentNotes       from './pages/student/Notes'
import Forum              from './pages/student/Forum'
import ReportCard         from './pages/student/ReportCard'
import AIAssistant        from './pages/student/AIAssistant'
import StudentTimetable   from './pages/student/Timetable'
import TeacherSchedule    from './pages/student/TeacherSchedule'
import CGPACalculator     from './pages/student/CGPAPlanner'
import StudentProfile     from './pages/student/Profile'

function Guard({ role, children }) {
  const { user, isReady } = useAuth()
  if (!isReady) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div className="dot-loader"><span className="dot"/><span className="dot"/><span className="dot"/></div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/login" replace />
  return children
}

function Redirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Guard><Redirect /></Guard>} />

        {/* ── TEACHER ── */}
        <Route path="/teacher" element={<Guard role="teacher"><TeacherLayout /></Guard>}>
          <Route path="dashboard"      element={<TeacherDashboard />} />
          <Route path="analytics"      element={<Analytics />} />
          <Route path="my-classes"     element={<MyClasses />} />
          <Route path="attendance"     element={<MarkAttendance />} />
          <Route path="marks"          element={<MarksEntry />} />
          <Route path="assignments"    element={<TeacherAssignments />} />
          <Route path="announcements"  element={<TeacherAnnouncements />} />
          <Route path="notes"          element={<TeacherNotes />} />
          <Route path="ai-tools"       element={<AITools />} />
          <Route path="question-paper" element={<QuestionPaper />} />
          <Route path="timetable"      element={<TeacherTimetable />} />
          <Route path="availability"   element={<TeacherAvailability />} />
          <Route path="progress-report" element={<ProgressReport />} />
          <Route path="profile"        element={<TeacherProfile />} />
        </Route>

        {/* ── STUDENT ── */}
        <Route path="/student" element={<Guard role="student"><StudentLayout /></Guard>}>
          <Route path="dashboard"        element={<StudentDashboard />} />
          <Route path="attendance"       element={<StudentAttendance />} />
          <Route path="assignments"      element={<StudentAssignments />} />
          <Route path="notes"            element={<StudentNotes />} />
          <Route path="forum"            element={<Forum />} />
          <Route path="report-card"      element={<ReportCard />} />
          <Route path="ai-assistant"     element={<AIAssistant />} />
          <Route path="timetable"        element={<StudentTimetable />} />
          <Route path="teacher-schedule" element={<TeacherSchedule />} />
          <Route path="cgpa-calculator"  element={<CGPACalculator />} />
          <Route path="profile"          element={<StudentProfile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}