import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'

function formatTime(value) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function App() {
  const [username, setUsername] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [users, setUsers] = useState([])
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => () => socketRef.current?.close(), [])
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages])

  function connect(event) {
    event.preventDefault()
    const name = draftName.trim()
    if (!name) return
    socketRef.current?.close()
    const socket = new WebSocket(`${WS_URL}?username=${encodeURIComponent(name)}`)
    socket.onopen = () => { setUsername(name); setConnected(true) }
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'users') setUsers(message.users || [])
      else setMessages((current) => [...current, message])
    }
    socket.onclose = () => { setConnected(false); setUsers([]) }
    socket.onerror = () => setConnected(false)
    socketRef.current = socket
  }

  function disconnect() {
    socketRef.current?.close()
    socketRef.current = null
    setConnected(false)
    setUsers([])
  }

  function sendMessage(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !connected || socketRef.current?.readyState !== WebSocket.OPEN) return
    socketRef.current.send(JSON.stringify({ type: 'message', username, text, timestamp: new Date().toISOString() }))
    setDraft('')
  }

  return (
    <main className="app-shell">
      <section className="chat-card">
        <header className="chat-header">
          <div>
            <p className="eyebrow">REALTIME / WS</p>
            <h1>Общий чат</h1>
            <p className="subtitle">Сообщения появляются у всех подключённых пользователей</p>
          </div>
          <span className={`status ${connected ? 'online' : ''}`}><i />{connected ? 'В сети' : 'Не подключён'}</span>
        </header>

        <div className="chat-layout">
          <section className="conversation">
            <div className="messages" aria-live="polite">
              {!messages.length && <div className="empty-state"><span>◎</span><strong>Здесь пока тихо</strong><p>Подключитесь и отправьте первое сообщение.</p></div>}
              {messages.map((message, index) => message.type === 'system' ? (
                <div className="system-message" key={`${message.timestamp}-${index}`}>{message.text}</div>
              ) : (
                <article className={`message ${message.username === username ? 'own' : ''}`} key={`${message.timestamp}-${index}`}>
                  <div className="message-meta"><strong>{message.username}</strong><time>{formatTime(message.timestamp)}</time></div>
                  <p>{message.text}</p>
                </article>
              ))}
              <div ref={bottomRef} />
            </div>
            <form className="composer" onSubmit={sendMessage}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!connected} placeholder={connected ? 'Введите сообщение...' : 'Сначала подключитесь'} maxLength="2000" />
              <button className="send-button" type="submit" disabled={!connected || !draft.trim()} aria-label="Отправить сообщение">→</button>
            </form>
          </section>

          <aside className="sidebar">
            <div className="sidebar-title"><span>Участники</span><b>{users.length}</b></div>
            <div className="user-list">{users.map((user, index) => <div className="user" key={`${user}-${index}`}><span className="avatar">{user.slice(0, 1).toUpperCase()}</span><span>{user}{user === username && <small> вы</small>}</span><i /> </div>)}</div>
            <div className="connection-panel">
              <p className="panel-label">Подключение</p>
              {!connected ? <form onSubmit={connect}><label htmlFor="name">Ваше имя</label><input id="name" value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Например, Анна" maxLength="40" /><button type="submit">Войти в чат</button></form> : <><p className="connected-as">Вы вошли как <strong>{username}</strong></p><button className="leave-button" type="button" onClick={disconnect}>Выйти из чата</button></>}
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
