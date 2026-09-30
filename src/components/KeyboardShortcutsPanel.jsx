import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  DEFAULT_SHORTCUTS,
  ACTION_LABELS,
  ACTION_DESCS,
  buildActionGroups,
  getAllConflicts,
  eventToShortcut,
} from '../utils/shortcuts';
import './KeyboardShortcutsPanel.css';

const KeyboardShortcutsPanel = memo(function KeyboardShortcutsPanel({ settings, onSettingsChange }) {
  const [recordingKey, setRecordingKey] = useState(null);
  const [query, setQuery] = useState('');

  const shortcuts = settings?.shortcuts || DEFAULT_SHORTCUTS;

  // 实时扫描全部动作的冲突，而不是只在录制那一刻判断，已存在的冲突也能被发现
  const conflicts = useMemo(() => getAllConflicts(shortcuts), [shortcuts]);

  const groups = useMemo(() => buildActionGroups(), []);

  const visibleGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return groups;
    return groups
      .map((group) => ({
        ...group,
        actions: group.actions.filter((action) => {
          const text = `${ACTION_LABELS[action] || ''} ${ACTION_DESCS[action] || ''} ${shortcuts[action] || ''}`;
          return text.toLowerCase().includes(keyword);
        }),
      }))
      .filter((group) => group.actions.length > 0);
  }, [groups, query, shortcuts]);

  const handleKeyDown = useCallback((e) => {
    if (!recordingKey) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setRecordingKey(null);
      return;
    }

    const shortcutStr = eventToShortcut(e);
    // 只按了修饰键（Ctrl/Shift/Alt）时不算一个有效快捷键，继续等待
    if (!shortcutStr) return;

    onSettingsChange({ ...settings, shortcuts: { ...shortcuts, [recordingKey]: shortcutStr } });
    setRecordingKey(null);
  }, [recordingKey, shortcuts, settings, onSettingsChange]);

  useEffect(() => {
    if (recordingKey) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [recordingKey, handleKeyDown]);

  const handleStartRecording = (action) => {
    setRecordingKey(action);
  };

  const handleClear = (action) => {
    onSettingsChange({ ...settings, shortcuts: { ...shortcuts, [action]: '' } });
  };

  const handleReset = (action) => {
    onSettingsChange({ ...settings, shortcuts: { ...shortcuts, [action]: DEFAULT_SHORTCUTS[action] } });
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

  const renderConflict = (action) => {
    const others = conflicts[action];
    if (!others || others.length === 0) return null;
    return (
      <div className="shortcut-conflict">
        与「{others.map((other) => ACTION_LABELS[other] || other).join('」「')}」冲突
      </div>
    );
  };

  return (
    <div className="keyboard-shortcuts-panel">
      <div className="shortcuts-intro">
        点击快捷键行，然后按下新的按键组合进行绑定。支持组合键（如 Ctrl+Shift+P）。
        按 ESC 取消录制，点击「×」清除快捷键绑定。
      </div>

      <div className="shortcuts-toolbar">
        <input
          className="shortcuts-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索动作或按键..."
        />
        {query && (
          <button className="shortcuts-search-clear" onClick={() => setQuery('')} title="清除搜索">
            ×
          </button>
        )}
      </div>

      {visibleGroups.length === 0 && (
        <div className="shortcuts-empty">没有匹配的快捷键</div>
      )}

      <div className="shortcuts-list">
        {visibleGroups.map((group) => (
          <div className="shortcuts-group" key={group.id}>
            <div className="shortcuts-group-title">{group.label}</div>
            {group.actions.map((action) => (
              <div
                key={action}
                className={`shortcut-item ${recordingKey === action ? 'recording' : ''} ${conflicts[action] ? 'has-conflict' : ''}`}
              >
                <div className="shortcut-info">
                  <div className="shortcut-action">{ACTION_LABELS[action]}</div>
                  <div className="shortcut-desc">{ACTION_DESCS[action]}</div>
                  {renderConflict(action)}
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

export default KeyboardShortcutsPanel;
