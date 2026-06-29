import { useState, useEffect } from 'react';
import './SettingsModal.css';
import KeyboardShortcutsPanel, { DEFAULT_SHORTCUTS } from './KeyboardShortcutsPanel';

const DEFAULT_SETTINGS = {
  autoPlayNext: true,
  rememberProgress: true,
  autoPlayOnStart: false,
  defaultVolume: 80,
  sidebarWidth: 280,
  lyricWidth: 360,
  playerHeight: 120,
  showRatingStars: true,
  waveformHeight: 70,
  showLyric: true,
  autoScrollLyric: true,
  skipSeconds: 5,
  theme: 'dark',
  autoHideSidebar: true,
  shortcuts: { ...DEFAULT_SHORTCUTS },
};

const TABS = [
  { id: 'basic', label: '基本' },
  { id: 'appearance', label: '外观' },
  { id: 'main', label: '主界面' },
  { id: 'player', label: '播放界面' },
  { id: 'shortcuts', label: '快捷键' },
  { id: 'about', label: '关于' },
];

function SettingsModal({ isOpen, onClose, onSave, currentSettings, defaultTab }) {
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
        <div className="settings-section-title">主题</div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">界面主题</div>
            <div className="setting-desc">选择深色或浅色模式</div>
          </div>
          <div className="theme-selector">
            <button
              className={`theme-toggle-btn ${settings.theme === 'dark' ? 'active' : ''}`}
              onClick={() => handleThemeChange('dark')}
              title="深色模式"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>
              </svg>
            </button>
            <button
              className={`theme-toggle-btn ${settings.theme === 'light' ? 'active' : ''}`}
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
            </button>
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
            <div className="setting-label">字幕字体大小</div>
            <div className="setting-desc">歌词本中字幕的显示字号</div>
          </div>
          <div className="setting-control">
            <div className="slider-control">
              <div className="slider-value">{settings.subtitleFontSize || 14}px</div>
              <Slider
                value={settings.subtitleFontSize || 14}
                min={12}
                max={24}
                onChange={(e) => handleSlider('subtitleFontSize', e.target.value)}
              />
            </div>
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
}

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
