import { useState, useEffect, memo } from 'react';
import './SettingsModal.css';
import KeyboardShortcutsPanel, { DEFAULT_SHORTCUTS } from './KeyboardShortcutsPanel';
import { getPresetList } from '../utils/upscaleShaders';
import { THEME_PRESETS } from '../utils/themePresets';

const SUBTITLE_STYLE_PRESETS = {
  default: {
    name: '默认',
    lyricFontSize: 14,
    lyricColor: '#e8e6e3',
    lyricActiveColor: '#c96442',
    lyricFontWeight: 400,
    lyricShadow: true,
    lyricShadowBlur: 2,
    immersiveFontSize: 22,
    immersiveActiveFontSize: 34,
    immersiveColor: '#ffffff',
    immersiveActiveColor: '#ffffff',
    immersiveFontWeight: 500,
    immersiveShadow: true,
    immersiveShadowBlur: 4,
  },
  warm: {
    name: '暖橙',
    lyricFontSize: 14,
    lyricColor: '#e8e6e3',
    lyricActiveColor: '#c96442',
    lyricFontWeight: 500,
    lyricShadow: true,
    lyricShadowBlur: 2,
    immersiveFontSize: 22,
    immersiveActiveFontSize: 34,
    immersiveColor: '#ffe8d9',
    immersiveActiveColor: '#ffb380',
    immersiveFontWeight: 600,
    immersiveShadow: true,
    immersiveShadowBlur: 6,
  },
  minimal: {
    name: '简约',
    lyricFontSize: 14,
    lyricColor: '#b0ada8',
    lyricActiveColor: '#ffffff',
    lyricFontWeight: 400,
    lyricShadow: false,
    lyricShadowBlur: 0,
    immersiveFontSize: 20,
    immersiveActiveFontSize: 28,
    immersiveColor: 'rgba(255,255,255,0.7)',
    immersiveActiveColor: '#ffffff',
    immersiveFontWeight: 400,
    immersiveShadow: true,
    immersiveShadowBlur: 3,
  },
  highContrast: {
    name: '高对比',
    lyricFontSize: 15,
    lyricColor: '#ffffff',
    lyricActiveColor: '#ffd700',
    lyricFontWeight: 600,
    lyricShadow: true,
    lyricShadowBlur: 4,
    immersiveFontSize: 24,
    immersiveActiveFontSize: 38,
    immersiveColor: '#ffffff',
    immersiveActiveColor: '#ffd700',
    immersiveFontWeight: 700,
    immersiveShadow: true,
    immersiveShadowBlur: 8,
  },
};

const DEFAULT_SETTINGS = {
  autoPlayNext: true,
  rememberProgress: true,
  autoPlayOnStart: false,
  defaultVolume: 80,
  sidebarWidth: 280,
  lyricWidth: 360,
  playerHeight: 96,
  showRatingStars: true,
  waveformHeight: 56,
  showLyric: true,
  autoScrollLyric: true,
  skipSeconds: 5,
  theme: 'light',
  accentPreset: 'warm-orange',
  customAccentColor: '#c96442',
  viewMode: 'grid',
  loopMode: 'none',
  shuffle: false,
  autoHideSidebar: true,
  shortcuts: { ...DEFAULT_SHORTCUTS },
  downloadConcurrency: 3,
  autoImportDownloaded: true,
  downloadNotify: true,
  upscalePreset: 'anime',
  closeToTray: true,
  subtitleStylePreset: 'default',
  subtitleLyricFontSize: 14,
  subtitleLyricColor: '#e8e6e3',
  subtitleLyricActiveColor: '#c96442',
  subtitleLyricFontWeight: 400,
  subtitleLyricShadow: true,
  subtitleLyricShadowBlur: 2,
  subtitleImmersiveFontSize: 22,
  subtitleImmersiveActiveFontSize: 34,
  subtitleImmersiveColor: '#ffffff',
  subtitleImmersiveActiveColor: '#ffffff',
  subtitleImmersiveFontWeight: 500,
  subtitleImmersiveShadow: true,
  subtitleImmersiveShadowBlur: 4,
  globalMediaKeys: true,
  trackChangeNotification: true,
  enableMediaSession: true,
  continuousPlay: false,
  restorePlayOnStart: false,
  persistPlayQueue: true,
};

const TABS = [
  { id: 'basic', label: '基本' },
  { id: 'appearance', label: '外观' },
  { id: 'main', label: '主界面' },
  { id: 'player', label: '播放界面' },
  { id: 'shortcuts', label: '快捷键' },
  { id: 'data', label: '数据管理' },
  { id: 'about', label: '关于' },
];

const SettingsModal = memo(function SettingsModal({ isOpen, onClose, onSave, currentSettings, defaultTab }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else if (isVisible) {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isVisible]);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('appSettings');
      let base = { ...DEFAULT_SETTINGS };
      if (saved) {
        try {
          base = { ...base, ...JSON.parse(saved) };
        } catch (e) {}
      }
      if (currentSettings) {
        base = { ...base, ...currentSettings };
      }
      setSettings(base);
      setActiveTab(defaultTab || 'basic');
    }
  }, [isOpen, defaultTab]);

  const handleToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSlider = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const handleThemeChange = (theme) => {
    setSettings((prev) => ({ ...prev, theme }));
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const handleSave = () => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    if (onSave) {
      onSave(settings);
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isVisible) return null;

  const renderBasicTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-section-title">播放设置</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">自动播放下一首</div>
            <div className="setting-desc">当前曲目播放完毕后自动播放下一首</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.autoPlayNext}
              onChange={() => handleToggle('autoPlayNext')}
            />
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">记忆播放进度</div>
            <div className="setting-desc">下次打开时从上次播放位置继续</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.rememberProgress}
              onChange={() => handleToggle('rememberProgress')}
            />
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">启动时自动播放</div>
            <div className="setting-desc">应用启动后自动开始播放</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.autoPlayOnStart}
              onChange={() => handleToggle('autoPlayOnStart')}
            />
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">作品间连续播放</div>
            <div className="setting-desc">当前作品播放完毕后自动播放下一个作品</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.continuousPlay}
              onChange={() => handleToggle('continuousPlay')}
            />
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">启动恢复上次播放</div>
            <div className="setting-desc">启动时自动恢复上次播放的作品和位置</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.restorePlayOnStart}
              onChange={() => handleToggle('restorePlayOnStart')}
            />
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">持久化播放队列</div>
            <div className="setting-desc">关闭后重新打开时恢复播放队列</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.persistPlayQueue}
              onChange={() => handleToggle('persistPlayQueue')}
            />
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">音量</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">默认音量</div>
            <div className="setting-desc">应用启动时的默认音量大小</div>
          </div>
          <div className="setting-control">
            <div className="slider-control">
              <div className="slider-value">{settings.defaultVolume}%</div>
              <Slider
                value={settings.defaultVolume}
                min={0}
                max={100}
                onChange={(e) => handleSlider('defaultVolume', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">网络</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">代理地址</div>
            <div className="setting-desc">
              在线音声请求使用的代理，如 http://127.0.0.1:7897
              <br />
              留空则使用系统环境变量或直连
            </div>
          </div>
          <div className="setting-control">
            <input
              type="text"
              className="settings-input"
              placeholder="http://127.0.0.1:7897"
              value={settings.proxyUrl || ''}
              onChange={(e) => setSettings((p) => ({ ...p, proxyUrl: e.target.value }))}
            />
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">系统托盘</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">关闭窗口最小化到托盘</div>
            <div className="setting-desc">点击关闭按钮时隐藏到系统托盘，继续后台播放</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.closeToTray}
              onChange={() => handleToggle('closeToTray')}
            />
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">系统媒体集成</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">系统媒体控制</div>
            <div className="setting-desc">在 Windows 系统音量面板中显示播放信息和控制按钮</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.enableMediaSession}
              onChange={() => handleToggle('enableMediaSession')}
            />
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">全局媒体快捷键</div>
            <div className="setting-desc">使用键盘媒体键（播放/暂停/上一曲/下一曲）控制播放，无需切换到窗口</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.globalMediaKeys}
              onChange={() => {
                handleToggle('globalMediaKeys')
                if (window.electronAPI?.globalShortcutRegister) {
                  setTimeout(() => {
                    if (settings.globalMediaKeys) {
                      window.electronAPI.globalShortcutUnregister?.()
                    } else {
                      window.electronAPI.globalShortcutRegister?.()
                    }
                  }, 0)
                }
              }}
            />
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">曲目切换通知</div>
            <div className="setting-desc">切换曲目时显示系统通知，显示曲目和作品信息</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.trackChangeNotification}
              onChange={() => handleToggle('trackChangeNotification')}
            />
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">下载</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">最大同时下载数</div>
            <div className="setting-desc">同一任务内同时下载的文件数量</div>
          </div>
          <div className="setting-control">
            <div className="slider-control">
              <div className="slider-value">{settings.downloadConcurrency}</div>
              <Slider
                value={settings.downloadConcurrency}
                min={1}
                max={8}
                onChange={(e) => handleSlider('downloadConcurrency', e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">下载完成通知</div>
            <div className="setting-desc">任务完成或失败时显示 Toast 通知</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.downloadNotify}
              onChange={() => handleToggle('downloadNotify')}
            />
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">自动导入媒体库</div>
            <div className="setting-desc">下载完成后自动添加到本地媒体库</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.autoImportDownloaded}
              onChange={() => handleToggle('autoImportDownloaded')}
            />
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">翻译</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">翻译引擎</div>
            <div className="setting-desc">选择翻译服务提供商，翻译失败时自动切换其他引擎</div>
          </div>
          <div className="setting-control">
            <select
              className="settings-select"
              value={settings.translateEngine || 'google'}
              onChange={(e) => setSettings((p) => ({ ...p, translateEngine: e.target.value }))}
            >
              <option value="google">谷歌翻译</option>
              <option value="microsoft">微软翻译</option>
              <option value="baidu">百度翻译</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAppearanceTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-section-title">主题模式</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">界面主题</div>
            <div className="setting-desc">选择浅色、深色或跟随系统</div>
          </div>
          <div className="theme-mode-selector">
            <button
              className={`theme-mode-btn ${settings.theme === 'light' ? 'active' : ''}`}
              onClick={() => handleThemeChange('light')}
              title="浅色模式"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
              <span>浅色</span>
            </button>
            <button
              className={`theme-mode-btn ${settings.theme === 'dark' ? 'active' : ''}`}
              onClick={() => handleThemeChange('dark')}
              title="深色模式"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>
              </svg>
              <span>深色</span>
            </button>
            <button
              className={`theme-mode-btn ${settings.theme === 'auto' ? 'active' : ''}`}
              onClick={() => handleThemeChange('auto')}
              title="跟随系统"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span>自动</span>
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">主题配色</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">预设主题</div>
            <div className="setting-desc">选择喜欢的主题色</div>
          </div>
        </div>
        <div className="accent-presets-grid">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`accent-preset-btn ${settings.accentPreset === preset.id ? 'active' : ''}`}
              onClick={() => setSettings((p) => ({ ...p, accentPreset: preset.id }))}
              title={`${preset.name} — ${preset.description}`}
            >
              <div
                className="accent-preset-preview"
                style={{
                  background: `linear-gradient(135deg, ${preset.lightColor} 0%, ${preset.darkColor} 100%)`,
                }}
              />
              <span className="accent-preset-name">{preset.name}</span>
            </button>
          ))}
          <button
            className={`accent-preset-btn ${settings.accentPreset === 'custom' ? 'active' : ''}`}
            onClick={() => setSettings((p) => ({ ...p, accentPreset: 'custom' }))}
            title="自定义主题色"
          >
            <div
              className="accent-preset-preview custom-preview"
              style={{ background: settings.customAccentColor || '#c96442' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                <path d="M2 2l7.586 7.586"/>
                <circle cx="11" cy="11" r="2"/>
              </svg>
            </div>
            <span className="accent-preset-name">自定义</span>
          </button>
        </div>
        {settings.accentPreset === 'custom' && (
          <div className="setting-item custom-accent-item">
            <div className="setting-info">
              <div className="setting-label">自定义颜色</div>
              <div className="setting-desc">选择你喜欢的主题色</div>
            </div>
            <div className="setting-control">
              <div className="color-picker-wrapper">
                <input
                  type="color"
                  className="color-picker-input"
                  value={settings.customAccentColor || '#c96442'}
                  onChange={(e) => setSettings((p) => ({ ...p, customAccentColor: e.target.value }))}
                />
                <span className="color-picker-value">{settings.customAccentColor || '#c96442'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">图片超分</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">沉浸式封面质量</div>
            <div className="setting-desc">选择沉浸式模式下封面图片的放大算法，越高清处理越慢</div>
          </div>
          <div className="setting-control">
            <select
              className="settings-select"
              value={settings.upscalePreset || 'anime'}
              onChange={(e) => setSettings((p) => ({ ...p, upscalePreset: e.target.value }))}
            >
              {getPresetList().map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.name} — {preset.description}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">音频可视化</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">显示频谱</div>
            <div className="setting-desc">在播放器和沉浸式模式中显示音频频谱动画</div>
          </div>
          <div className="setting-control">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.showSpectrum !== false}
                onChange={(e) => setSettings((p) => ({ ...p, showSpectrum: e.target.checked }))}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">可视化模式</div>
            <div className="setting-desc">选择频谱可视化的显示样式</div>
          </div>
          <div className="setting-control">
            <select
              className="settings-select"
              value={settings.spectrumMode || 'bars'}
              onChange={(e) => setSettings((p) => ({ ...p, spectrumMode: e.target.value }))}
              disabled={settings.showSpectrum === false}
            >
              <option value="bars">柱状图</option>
              <option value="wave">波形图</option>
              <option value="circle">圆形频谱</option>
            </select>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">灵敏度</div>
            <div className="setting-desc">调整频谱动画的反应灵敏度</div>
          </div>
          <div className="setting-control">
            <div className="setting-slider-wrapper">
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={settings.spectrumSensitivity || 1.5}
                onChange={(e) => setSettings((p) => ({ ...p, spectrumSensitivity: parseFloat(e.target.value) }))}
                className="setting-slider"
                disabled={settings.showSpectrum === false}
              />
              <span className="setting-slider-value">
                {settings.spectrumSensitivity || 1.5}x
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMainTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-section-title">界面布局</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">侧边栏宽度</div>
            <div className="setting-desc">调整左侧作品列表的宽度</div>
          </div>
          <div className="setting-control">
            <div className="slider-control">
              <div className="slider-value">{settings.sidebarWidth}px</div>
              <Slider
                value={settings.sidebarWidth}
                min={200}
                max={400}
                onChange={(e) => handleSlider('sidebarWidth', e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">歌词本宽度</div>
            <div className="setting-desc">调整右侧歌词面板的宽度</div>
          </div>
          <div className="setting-control">
            <div className="slider-control">
              <div className="slider-value">{settings.lyricWidth}px</div>
              <Slider
                value={settings.lyricWidth}
                min={280}
                max={500}
                onChange={(e) => handleSlider('lyricWidth', e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">播放栏高度</div>
            <div className="setting-desc">调整底部播放控制栏的高度</div>
          </div>
          <div className="setting-control">
            <div className="slider-control">
              <div className="slider-value">{settings.playerHeight}px</div>
              <Slider
                value={settings.playerHeight}
                min={80}
                max={160}
                onChange={(e) => handleSlider('playerHeight', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">显示</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">显示评分星星</div>
            <div className="setting-desc">在作品列表中显示评分星星</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.showRatingStars}
              onChange={() => handleToggle('showRatingStars')}
            />
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">打开详情时隐藏侧边栏</div>
            <div className="setting-desc">选中作品后自动隐藏左侧列表，让详情区占满更多空间</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.autoHideSidebar}
              onChange={() => handleToggle('autoHideSidebar')}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlayerTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-section-title">播放控制</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">快进/回退秒数</div>
            <div className="setting-desc">点击快进/回退按钮时跳转的秒数</div>
          </div>
          <div className="setting-control">
            <div className="slider-control">
              <div className="slider-value">{settings.skipSeconds}秒</div>
              <Slider
                value={settings.skipSeconds}
                min={1}
                max={60}
                step={1}
                onChange={(e) => handleSlider('skipSeconds', parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">波形图高度</div>
            <div className="setting-desc">调整播放栏中波形图的显示高度</div>
          </div>
          <div className="setting-control">
            <div className="slider-control">
              <div className="slider-value">{settings.waveformHeight}px</div>
              <Slider
                value={settings.waveformHeight}
                min={40}
                max={120}
                onChange={(e) => handleSlider('waveformHeight', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">歌词</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">显示歌词本</div>
            <div className="setting-desc">在播放界面显示歌词本面板</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.showLyric}
              onChange={() => handleToggle('showLyric')}
            />
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">自动滚动歌词</div>
            <div className="setting-desc">播放时歌词自动滚动到当前行</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.autoScrollLyric}
              onChange={() => handleToggle('autoScrollLyric')}
            />
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">字幕</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">字幕语言优先级</div>
            <div className="setting-desc">自动选择字幕后，优先使用的语言</div>
          </div>
          <div className="setting-control">
            <select
              className="settings-select"
              value={settings.subtitleLangPriority || 'auto'}
              onChange={(e) => setSettings((p) => ({ ...p, subtitleLangPriority: e.target.value }))}
            >
              <option value="auto">自动</option>
              <option value="zh">中文优先</option>
              <option value="ja">日文优先</option>
              <option value="en">英文优先</option>
            </select>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">默认显示翻译</div>
            <div className="setting-desc">加载字幕时自动显示双语（原文+译文）</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.autoTranslateSubtitle || false}
              onChange={() => handleToggle('autoTranslateSubtitle')}
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">字幕样式</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">样式预设</div>
            <div className="setting-desc">快速应用预设的字幕样式</div>
          </div>
          <div className="setting-control">
            <div className="subtitle-style-presets">
              {Object.entries(SUBTITLE_STYLE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  className={`style-preset-btn ${settings.subtitleStylePreset === key ? 'active' : ''}`}
                  onClick={() => {
                    setSettings((p) => ({
                      ...p,
                      subtitleStylePreset: key,
                      subtitleLyricFontSize: preset.lyricFontSize,
                      subtitleLyricColor: preset.lyricColor,
                      subtitleLyricActiveColor: preset.lyricActiveColor,
                      subtitleLyricFontWeight: preset.lyricFontWeight,
                      subtitleLyricShadow: preset.lyricShadow,
                      subtitleLyricShadowBlur: preset.lyricShadowBlur,
                      subtitleImmersiveFontSize: preset.immersiveFontSize,
                      subtitleImmersiveActiveFontSize: preset.immersiveActiveFontSize,
                      subtitleImmersiveColor: preset.immersiveColor,
                      subtitleImmersiveActiveColor: preset.immersiveActiveColor,
                      subtitleImmersiveFontWeight: preset.immersiveFontWeight,
                      subtitleImmersiveShadow: preset.immersiveShadow,
                      subtitleImmersiveShadowBlur: preset.immersiveShadowBlur,
                    }))
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">歌词本字幕</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">字体大小</div>
            <div className="setting-desc">歌词本中字幕的显示字号</div>
          </div>
          <div className="setting-control">
            <div className="slider-control">
              <div className="slider-value">{settings.subtitleLyricFontSize || 14}px</div>
              <Slider
                value={settings.subtitleLyricFontSize || 14}
                min={12}
                max={24}
                onChange={(e) => handleSlider('subtitleLyricFontSize', e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">普通行颜色</div>
            <div className="setting-desc">非激活状态字幕行的颜色</div>
          </div>
          <div className="setting-control">
            <div className="color-input-wrapper">
              <input
                type="color"
                className="color-input"
                value={settings.subtitleLyricColor || '#e8e6e3'}
                onChange={(e) => setSettings((p) => ({ ...p, subtitleLyricColor: e.target.value }))}
              />
              <span className="color-hex">{settings.subtitleLyricColor || '#e8e6e3'}</span>
            </div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">激活行颜色</div>
            <div className="setting-desc">当前播放字幕行的高亮颜色</div>
          </div>
          <div className="setting-control">
            <div className="color-input-wrapper">
              <input
                type="color"
                className="color-input"
                value={settings.subtitleLyricActiveColor || '#c96442'}
                onChange={(e) => setSettings((p) => ({ ...p, subtitleLyricActiveColor: e.target.value }))}
              />
              <span className="color-hex">{settings.subtitleLyricActiveColor || '#c96442'}</span>
            </div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">字体粗细</div>
            <div className="setting-desc">字幕文字的字重</div>
          </div>
          <div className="setting-control">
            <select
              className="settings-select"
              value={settings.subtitleLyricFontWeight || 400}
              onChange={(e) => setSettings((p) => ({ ...p, subtitleLyricFontWeight: parseInt(e.target.value) }))}
            >
              <option value={300}>细体 (300)</option>
              <option value={400}>常规 (400)</option>
              <option value={500}>中等 (500)</option>
              <option value={600}>半粗 (600)</option>
              <option value={700}>粗体 (700)</option>
            </select>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">文字阴影</div>
            <div className="setting-desc">为字幕添加阴影增强可读性</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.subtitleLyricShadow !== false}
              onChange={() => handleToggle('subtitleLyricShadow')}
            />
          </div>
        </div>
        {settings.subtitleLyricShadow !== false && (
          <div className="setting-item sub-setting">
            <div className="setting-info">
              <div className="setting-label">阴影模糊度</div>
              <div className="setting-desc">阴影的模糊半径</div>
            </div>
            <div className="setting-control">
              <div className="slider-control">
                <div className="slider-value">{settings.subtitleLyricShadowBlur || 2}px</div>
                <Slider
                  value={settings.subtitleLyricShadowBlur || 2}
                  min={0}
                  max={8}
                  step={1}
                  onChange={(e) => handleSlider('subtitleLyricShadowBlur', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">沉浸式字幕</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">普通行字号</div>
            <div className="setting-desc">沉浸式模式中非激活字幕的字号</div>
          </div>
          <div className="setting-control">
            <div className="slider-control">
              <div className="slider-value">{settings.subtitleImmersiveFontSize || 22}px</div>
              <Slider
                value={settings.subtitleImmersiveFontSize || 22}
                min={14}
                max={40}
                onChange={(e) => handleSlider('subtitleImmersiveFontSize', e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">激活行字号</div>
            <div className="setting-desc">沉浸式模式中当前字幕的字号</div>
          </div>
          <div className="setting-control">
            <div className="slider-control">
              <div className="slider-value">{settings.subtitleImmersiveActiveFontSize || 34}px</div>
              <Slider
                value={settings.subtitleImmersiveActiveFontSize || 34}
                min={20}
                max={60}
                onChange={(e) => handleSlider('subtitleImmersiveActiveFontSize', e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">普通行颜色</div>
            <div className="setting-desc">非激活状态字幕行的颜色</div>
          </div>
          <div className="setting-control">
            <div className="color-input-wrapper">
              <input
                type="color"
                className="color-input"
                value={settings.subtitleImmersiveColor || '#ffffff'}
                onChange={(e) => setSettings((p) => ({ ...p, subtitleImmersiveColor: e.target.value }))}
              />
              <span className="color-hex">{settings.subtitleImmersiveColor || '#ffffff'}</span>
            </div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">激活行颜色</div>
            <div className="setting-desc">当前播放字幕行的高亮颜色</div>
          </div>
          <div className="setting-control">
            <div className="color-input-wrapper">
              <input
                type="color"
                className="color-input"
                value={settings.subtitleImmersiveActiveColor || '#ffffff'}
                onChange={(e) => setSettings((p) => ({ ...p, subtitleImmersiveActiveColor: e.target.value }))}
              />
              <span className="color-hex">{settings.subtitleImmersiveActiveColor || '#ffffff'}</span>
            </div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">字体粗细</div>
            <div className="setting-desc">字幕文字的字重</div>
          </div>
          <div className="setting-control">
            <select
              className="settings-select"
              value={settings.subtitleImmersiveFontWeight || 500}
              onChange={(e) => setSettings((p) => ({ ...p, subtitleImmersiveFontWeight: parseInt(e.target.value) }))}
            >
              <option value={300}>细体 (300)</option>
              <option value={400}>常规 (400)</option>
              <option value={500}>中等 (500)</option>
              <option value={600}>半粗 (600)</option>
              <option value={700}>粗体 (700)</option>
            </select>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">文字阴影</div>
            <div className="setting-desc">为字幕添加多层阴影增强可读性</div>
          </div>
          <div className="setting-control">
            <ToggleSwitch
              checked={settings.subtitleImmersiveShadow !== false}
              onChange={() => handleToggle('subtitleImmersiveShadow')}
            />
          </div>
        </div>
        {settings.subtitleImmersiveShadow !== false && (
          <div className="setting-item sub-setting">
            <div className="setting-info">
              <div className="setting-label">阴影模糊度</div>
              <div className="setting-desc">阴影的模糊半径</div>
            </div>
            <div className="setting-control">
              <div className="slider-control">
                <div className="slider-value">{settings.subtitleImmersiveShadowBlur || 4}px</div>
                <Slider
                  value={settings.subtitleImmersiveShadowBlur || 4}
                  min={0}
                  max={12}
                  step={1}
                  onChange={(e) => handleSlider('subtitleImmersiveShadowBlur', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderShortcutsTab = () => (
    <div className="settings-tab-content">
      <KeyboardShortcutsPanel
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  );

  const [dataStats, setDataStats] = useState(null);
  const [exportKeys, setExportKeys] = useState([]);
  const [importMode, setImportMode] = useState('merge');
  const [importResult, setImportResult] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'data') {
      loadDataStats();
    }
  }, [isOpen, activeTab]);

  const loadDataStats = async () => {
    try {
      const stats = await window.electronAPI.backupGetStats();
      setDataStats(stats);
      if (stats?.exportableKeys) {
        setExportKeys([...stats.exportableKeys]);
      }
    } catch (e) {
      console.error('Failed to load data stats:', e);
    }
  };

  const handleToggleExportKey = (key) => {
    setExportKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleSelectAllExport = () => {
    if (dataStats?.exportableKeys) {
      setExportKeys([...dataStats.exportableKeys]);
    }
  };

  const handleDeselectAllExport = () => {
    setExportKeys([]);
  };

  const handleExport = async () => {
    if (exportKeys.length === 0) return;
    setIsExporting(true);
    setImportResult(null);
    try {
      const jsonString = await window.electronAPI.backupExport(exportKeys);
      const dateStr = new Date().toISOString().slice(0, 10);
      const filePath = await window.electronAPI.backupSaveFile(jsonString, `lingyin-backup-${dateStr}.json`);
      if (filePath) {
        setImportResult({ type: 'export-success', message: `备份已保存到：${filePath}` });
      }
    } catch (e) {
      setImportResult({ type: 'error', message: `导出失败：${e.message || '未知错误'}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    setImportResult(null);
    try {
      const result = await window.electronAPI.backupOpenFile();
      if (!result) {
        setIsImporting(false);
        return;
      }
      const importRes = await window.electronAPI.backupImport(result.content, importMode);
      if (importRes.success) {
        setImportResult({
          type: 'import-success',
          message: `导入成功！导入了 ${importRes.importedKeys.length} 项数据`,
          detail: importRes.importedKeys.join('、'),
        });
        await loadDataStats();
      } else {
        setImportResult({ type: 'error', message: `导入失败：${importRes.error}` });
      }
    } catch (e) {
      setImportResult({ type: 'error', message: `导入失败：${e.message || '未知错误'}` });
    } finally {
      setIsImporting(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const renderDataTab = () => (
    <div className="settings-tab-content data-tab">
      {importResult && (
        <div className={`data-result-banner ${importResult.type}`}>
          <div className="result-message">{importResult.message}</div>
          {importResult.detail && <div className="result-detail">{importResult.detail}</div>}
          <button className="result-close" onClick={() => setImportResult(null)}>×</button>
        </div>
      )}

      <div className="settings-section">
        <div className="settings-section-title">数据统计</div>
        {dataStats ? (
          <div className="data-stats-grid">
            {dataStats.exportableKeys.map((key) => (
              <div key={key} className="data-stat-item">
                <div className="data-stat-label">{dataStats.keyLabels[key] || key}</div>
                <div className="data-stat-value">
                  {dataStats.stats[key]?.type === 'array' ? `${dataStats.stats[key]?.count || 0} 条` :
                   dataStats.stats[key]?.type === 'object' ? `${dataStats.stats[key]?.count || 0} 项` :
                   dataStats.stats[key]?.count || 0}
                </div>
              </div>
            ))}
            <div className="data-stat-item total">
              <div className="data-stat-label">总大小</div>
              <div className="data-stat-value">{formatBytes(dataStats.totalSize)}</div>
            </div>
          </div>
        ) : (
          <div className="data-loading">加载中...</div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">导出备份</div>
        <div className="setting-desc">选择要导出的数据类型，保存为 JSON 备份文件</div>
        <div className="data-export-actions">
          <button className="link-btn" onClick={handleSelectAllExport}>全选</button>
          <button className="link-btn" onClick={handleDeselectAllExport}>取消全选</button>
        </div>
        <div className="data-keys-grid">
          {dataStats?.exportableKeys.map((key) => (
            <label key={key} className="data-key-item">
              <input
                type="checkbox"
                checked={exportKeys.includes(key)}
                onChange={() => handleToggleExportKey(key)}
              />
              <span>{dataStats.keyLabels[key] || key}</span>
            </label>
          ))}
        </div>
        <button
          className="primary-btn data-action-btn"
          onClick={handleExport}
          disabled={exportKeys.length === 0 || isExporting}
        >
          {isExporting ? '导出中...' : '导出备份'}
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">导入备份</div>
        <div className="setting-desc">从备份文件中恢复数据</div>
        <div className="data-import-mode">
          <div className="import-mode-label">导入模式：</div>
          <div className="import-mode-options">
            <label className="import-mode-option">
              <input
                type="radio"
                name="importMode"
                value="merge"
                checked={importMode === 'merge'}
                onChange={() => setImportMode('merge')}
              />
              <span>合并（保留现有数据，添加新数据）</span>
            </label>
            <label className="import-mode-option">
              <input
                type="radio"
                name="importMode"
                value="overwrite"
                checked={importMode === 'overwrite'}
                onChange={() => setImportMode('overwrite')}
              />
              <span>覆盖（替换所有现有数据）</span>
            </label>
          </div>
        </div>
        <button
          className="secondary-btn data-action-btn"
          onClick={handleImport}
          disabled={isImporting}
        >
          {isImporting ? '导入中...' : '选择文件并导入'}
        </button>
        <div className="import-warning">
          ⚠️ 覆盖模式将删除所有现有数据，请谨慎操作
        </div>
      </div>
    </div>
  );

  const renderAboutTab = () => (
    <div className="settings-tab-content about-tab">
      <div className="about-logo">
        <img src="/app-icon.png" alt="聆音" className="about-icon-img" />
      </div>
      <div className="about-name">聆音 Lingyin</div>
      <div className="about-version">版本 1.1.0</div>
      <div className="about-desc">
        沉浸式 ASMR 音声播放器，
        支持波形可视化、歌词同步、作品管理等功能。
      </div>
      <div className="about-links">
        <span className="about-link">GitHub</span>
        <span className="about-dot">·</span>
        <span className="about-link">反馈建议</span>
      </div>
      <div className="about-actions">
        <button
          className="about-action-btn"
          onClick={async () => {
            await window.electronAPI.openLogFolder()
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          打开日志文件夹
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return renderBasicTab();
      case 'appearance':
        return renderAppearanceTab();
      case 'main':
        return renderMainTab();
      case 'player':
        return renderPlayerTab();
      case 'shortcuts':
        return renderShortcutsTab();
      case 'data':
        return renderDataTab();
      case 'about':
        return renderAboutTab();
      default:
        return null;
    }
  };

  return (
    <div className={`settings-overlay ${isAnimating ? 'fade-in' : 'fade-out'}`} onClick={handleCancel}>
      <div className={`settings-modal ${isAnimating ? 'zoom-in' : 'zoom-out'}`} onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title">设置</div>
          <button className="settings-close" onClick={handleCancel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="settings-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="settings-body">{renderTabContent()}</div>
        <div className="settings-footer">
          <button className="reset-btn" onClick={handleReset}>
            恢复默认
          </button>
          <div className="footer-buttons">
            <button className="cancel-btn" onClick={handleCancel}>
              取消
            </button>
            <button className="save-btn" onClick={handleSave}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
})

function ToggleSwitch({ checked, onChange }) {
  return (
    <div
      className={`toggle-switch ${checked ? 'checked' : ''}`}
      onClick={onChange}
    >
      <div className="toggle-thumb"></div>
    </div>
  );
}

function Slider({ value, min, max, onChange, step = 1 }) {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="custom-slider">
      <input
        type="range"
        className="custom-slider-input"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
      />
      <div className="custom-slider-track">
        <div className="custom-slider-fill" style={{ width: `${percentage}%` }} />
        <div className="custom-slider-thumb" style={{ left: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default SettingsModal;
