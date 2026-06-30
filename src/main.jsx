import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import MiniPlayer from './components/MiniPlayer.jsx'
import './styles/global.css'

const isMiniMode = window.location.hash.includes('mini')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isMiniMode ? <MiniPlayer /> : <App />}
  </React.StrictMode>,
)
