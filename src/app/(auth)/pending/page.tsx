export default function PendingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
          You're registered!
        </h1>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
          An officer will assign your JT family after the sorting process. 
          You'll get full access to the leaderboard and events once that's done.
        </p>
      </div>
    </div>
  )
}