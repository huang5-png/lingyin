import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import MiniPlayer from './components/MiniPlayer.jsx'
import './styles/global.css'
import { mobileAPI } from './bridge/mobileAPI'

// Capacitor 注入
if (!window.electronAPI) {
  window.electronAPI = mobileAPI;
  // 初始化手机端数据库
  import('./bridge/db-mobile').then(db => db.initDB());
}

const isMiniMode = window.location.hash.includes('mini')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isMiniMode ? <MiniPlayer /> : <App />}
  </React.StrictMode>,
)
