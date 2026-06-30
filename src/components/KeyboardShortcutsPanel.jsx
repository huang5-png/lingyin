import { useState, useEffect, useCallback, memo } from 'react';
import './KeyboardShortcutsPanel.css';

const DEFAULT_SHORTCUTS = {
  playPause: 'Space',
  prevTrack: 'ArrowLeft',
  nextTrack: 'ArrowRight',
  volumeUp: 'ArrowUp',
  volumeDown: 'ArrowDown',
  seekBackward: '',
  seekForward: '',
  toggleImmersive: '',
  exitImmersive: 'Escape',
  toggleQueue: '',
  openSettings: '',
  globalSearch: 'Ctrl+K',
};

const ACTION_LABELS = {
  playPause: '播放/暂停',
  prevTrack: '上一曲',
  nextTrack: '下一曲',
  volumeUp: '音量增加',
  volumeDown: '音量减少',
  seekBackward: '快退',
  seekForward: '快进',
  toggleImmersive: '切换沉浸式',
  exitImmersive: '退出沉浸式',
  toggleQueue: '显示/隐藏队列',
  openSettings: '打开设置',
  globalSearch: '全局搜索',
};

const ACTION_DESCS = {
  playPause: '切换播放与暂停状态',
  prevTrack: '跳转到上一首曲目',
  nextTrack: '跳转到下一首曲目',
  volumeUp: '增加播放音量',
  volumeDown: '减少播放音量',
  seekBackward: '向后快退指定秒数',
  seekForward: '向前快进指定秒数',
  toggleImmersive: '进入或退出沉浸式播放模式',
  exitImmersive: '关闭沉浸式播放模式',
  toggleQueue: '显示或隐藏播放队列浮层',
  openSettings: '打开设置面板',
  globalSearch: '打开/关闭全局搜索弹窗',
};

const KeyboardShortcutsPanel = memo(function KeyboardShortcutsPanel({ settings, onSettingsChange }) {
  const [recordingKey, setRecordingKey] = useState(null);
  const [conflicts, setConflicts] = useState({});

  const shortcuts = settings?.shortcuts || DEFAULT_SHORTCUTS;

  const handleKeyDown = useCallback((e) => {
    if (!recordingKey) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setRecordingKey(null);
      return;
    }

    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.startsWith('Arrow')) key = key;
    else if (key.length === 1) key = key.toUpperCase();
    else if (key === 'Escape') return;
    else if (key === 'Enter') key = 'Enter';
    else if (key === 'Backspace') key = 'Backspace';
    else if (key === 'Delete') key = 'Delete';
    else if (key === 'Tab') key = 'Tab';
    else if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;

    parts.push(key);
    const shortcutStr = parts.join('+');

    const newConflicts = { ...conflicts };
    let hasConflict = false;
    for (const [action, existingShortcut] of Object.entries(shortcuts)) {
      if (action !== recordingKey && existingShortcut && existingShortcut === shortcutStr) {
        newConflicts[recordingKey] = `与「${ACTION_LABELS[action]}」冲突`;
        hasConflict = true;
        break;
      }
    }
    if (!hasConflict) {
      delete newConflicts[recordingKey];
    }
    setConflicts(newConflicts);

    const newShortcuts = { ...shortcuts, [recordingKey]: shortcutStr };
    onSettingsChange({ ...settings, shortcuts: newShortcuts });
    setRecordingKey(null);
  }, [recordingKey, shortcuts, settings, onSettingsChange, conflicts]);

  useEffect(() => {
    if (recordingKey) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [recordingKey, handleKeyDown]);

  const handleStartRecording = (action) => {
    setRecordingKey(action);
    setConflicts((prev) => ({ ...prev, [action]: null }));
  };

  const handleClear = (action) => {
    const newShortcuts = { ...shortcuts, [action]: '' };
    onSettingsChange({ ...settings, shortcuts: newShortcuts });
  };

  const handleReset = (action) => {
    const newShortcuts = { ...shortcuts, [action]: DEFAULT_SHORTCUTS[action] };
    onSettingsChange({ ...settings, shortcuts: newShortcuts });
  };

  const handleResetAll = () => {
    onSettingsChange({ ...settings, shortcuts: { ...DEFAULT_SHORTCUTS } });
  };

  const formatShortcut = (shortcut) => {
    if (!shortcut) return <span className="shortcut-unset">未设置</span>;
    return shortcut.split('+').map((part, i) => (
      <span key={i}>
        {i > 0 && <span className="shortcut-sep">+</span>}
        <kbd className="shortcut-key">{part}</kbd>
      </span>
    ));
  };

  return (
    <div className="keyboard-shortcuts-panel">
      <div className="shortcuts-intro">
        点击快捷键行，然后按下新的按键组合进行绑定。支持组合键（如 Ctrl+Shift+P）。
        按 ESC 取消录制，点击「×」清除快捷键绑定。
      </div>

      <div className="shortcuts-list">
        {Object.entries(ACTION_LABELS).map(([action, label]) => (
          <div
            key={action}
            className={`shortcut-item ${recordingKey === action ? 'recording' : ''} ${conflicts[action] ? 'has-conflict' : ''}`}
          >
            <div className="shortcut-info">
              <div className="shortcut-action">{label}</div>
              <div className="shortcut-desc">{ACTION_DESCS[action]}</div>
              {conflicts[action] && (
                <div className="shortcut-conflict">{conflicts[action]}</div>
              )}
            </div>
            <div className="shortcut-binding">
              {recordingKey === action ? (
                <div className="shortcut-recording">
                  <span className="recording-indicator">按下按键...</span>
                  <button
                    className="shortcut-cancel-btn"
                    onClick={() => setRecordingKey(null)}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="shortcut-current" onClick={() => handleStartRecording(action)}>
                  {formatShortcut(shortcuts[action])}
                  {shortcuts[action] && (
                    <button
                      className="shortcut-clear-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClear(action);
                      }}
                      title="清除"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                  <button
                    className="shortcut-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRecording(action);
                    }}
                    title="修改"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    className="shortcut-reset-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset(action);
                    }}
                    title="恢复默认"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="shortcuts-footer">
        <button className="reset-all-btn" onClick={handleResetAll}>
          恢复所有默认
        </button>
      </div>
    </div>
  );
})

export { DEFAULT_SHORTCUTS };
export default KeyboardShortcutsPanel;
