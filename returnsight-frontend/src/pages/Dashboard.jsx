import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts'
import { useHistory } from '../hooks/useHistory'
import { Badge } from '../components/ui/Badge'

const COLORS = { High: '#EF4444', Medium: '#F59E0B', Low: '#22C55E' }

export default function Dashboard() {
  const navigate = useNavigate()
  const { history } = useHistory()

  const lineData = useMemo(() =>
    [...history].reverse().map(e => ({
      name: new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      risk: Math.round((e.result?.return_probability || 0) * 100),
      title: e.title?.slice(0, 20),
    })), [history])

  const pieData = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0 }
    history.forEach(e => { const l = e.result?.risk_level; if (l) counts[l]++ })
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  }, [history])

  const catData = useMemo(() => {
    const map = {}
    history.forEach(e => {
      const c = (e.category || 'Unknown').replace(/_/g, ' ').slice(0, 20)
      const p = (e.result?.return_probability || 0) * 100
      map[c] = map[c] || { total: 0, count: 0 }
      map[c].total += p; map[c].count++
    })
    return Object.entries(map).map(([name, { total, count }]) => ({ name, avg: Math.round(total / count) }))
      .sort((a, b) => b.avg - a.avg)
  }, [history])

  const tooltipStyle = { background: '#13141C', border: '1px solid rgba(255,255,255,0.08)', color: '#E5E7EB', borderRadius: 8 }

  if (history.length < 3) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-20 px-6 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="font-display font-bold text-xl mb-2">Your portfolio at a glance</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Analyze 3+ products to unlock the dashboard.</p>
        <button onClick={() => navigate('/')} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--orange)' }}>Start Analyzing →</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 px-6 pb-16 max-w-7xl mx-auto">
      <div className="mb-8">
        <button onClick={() => navigate('/')} className="text-xs mb-4 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--muted)' }}>← Back to Workbench</button>
        <h1 className="font-display font-bold text-2xl">Portfolio Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{history.length} products analyzed</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Summary cards */}
        {[
          { label: 'Total Analyzed', value: history.length },
          { label: 'Avg Return Risk', value: `${Math.round(history.reduce((s, e) => s + (e.result?.return_probability || 0), 0) / history.length * 100)}%` },
          { label: 'High Risk', value: history.filter(e => e.result?.risk_level === 'High').length, color: '#EF4444' },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{c.label}</p>
            <p className="font-display font-bold text-3xl" style={{ color: c.color || 'var(--orange)' }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Line chart */}
        <div className="rounded-xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-4" style={{ color: 'var(--muted)' }}>RISK OVER TIME</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lineData}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'Risk']} />
              <Line type="monotone" dataKey="risk" stroke="#FF5C1A" strokeWidth={2} dot={{ fill: '#FF5C1A', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="rounded-xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-4" style={{ color: 'var(--muted)' }}>RISK DISTRIBUTION</p>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {pieData.map(e => <Cell key={e.name} fill={COLORS[e.name]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {pieData.map(e => (
                <div key={e.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[e.name] }} />
                  <span className="text-xs" style={{ color: 'var(--text)' }}>{e.name}</span>
                  <span className="text-xs font-mono ml-auto" style={{ color: 'var(--muted)' }}>{e.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bar chart: avg risk by category */}
      {catData.length > 0 && (
        <div className="rounded-xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-4" style={{ color: 'var(--muted)' }}>AVG RISK BY CATEGORY</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={catData} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B7280' }} unit="%" axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} width={140} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'Avg Risk']} />
              <Bar dataKey="avg" fill="#FF5C1A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
