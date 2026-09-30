function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

function lightenColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function darkenColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function mixColor(hex1, hex2, ratio) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * ratio,
    c1.g + (c2.g - c1.g) * ratio,
    c1.b + (c2.b - c1.b) * ratio,
  );
}

export function generateAccentScale(baseColor, isDark = false) {
  const scale = {};
  const steps = [900, 800, 700, 600, 500, 400, 300, 200, 100];
  const baseIndex = isDark ? 6 : 6;

  steps.forEach((step, i) => {
    const distance = (i - baseIndex) / 3;
    if (distance < 0) {
      scale[`accent-${step}`] = darkenColor(baseColor, Math.abs(distance) * 0.6);
    } else {
      scale[`accent-${step}`] = lightenColor(baseColor, distance * 0.5);
    }
  });

  return scale;
}

export function generateThemeColors(accentColor, isDark = false) {
  const accentPrimary = accentColor;
  const accentSecondary = isDark
    ? lightenColor(accentColor, 0.15)
    : darkenColor(accentColor, 0.1);

  const { r, g, b } = hexToRgb(accentPrimary);
  const accentRgb = `${r}, ${g}, ${b}`;

  const scale = generateAccentScale(accentColor, isDark);

  return {
    '--accent-primary': accentPrimary,
    '--accent-secondary': accentSecondary,
    '--accent-gradient': `linear-gradient(135deg, ${accentPrimary} 0%, ${accentSecondary} 100%)`,
    '--accent-gradient-soft': isDark
      ? `linear-gradient(135deg, rgba(${accentRgb}, 0.15) 0%, rgba(${accentRgb}, 0.1) 100%)`
      : `linear-gradient(135deg, rgba(${accentRgb}, 0.12) 0%, rgba(${accentRgb}, 0.08) 100%)`,
    '--accent-glow': `rgba(${accentRgb}, ${isDark ? 0.25 : 0.2})`,
    '--bg-hover': `rgba(${accentRgb}, ${isDark ? 0.12 : 0.08})`,
    '--bg-active': `rgba(${accentRgb}, ${isDark ? 0.18 : 0.12})`,
    '--info-color': accentPrimary,
    '--shadow-glow': `0 0 16px rgba(${accentRgb}, ${isDark ? 0.25 : 0.2})`,
    '--shadow-glow-strong': `0 0 24px rgba(${accentRgb}, ${isDark ? 0.3 : 0.3})`,
    ...Object.fromEntries(
      Object.entries(scale).map(([key, value]) => [`--${key}`, value]),
    ),
  };
}

export const THEME_PRESETS = [
  {
    id: 'warm-orange',
    name: '暖橙',
    description: '经典暖橙色系，温暖舒适',
    lightColor: '#c96442',
    darkColor: '#d97757',
  },
  {
    id: 'forest-green',
    name: '森绿',
    description: '清新森林绿，自然宁静',
    lightColor: '#2d8659',
    darkColor: '#3da873',
  },
  {
    id: 'ocean-blue',
    name: '海蓝',
    description: '深邃海蓝色，沉静专注',
    lightColor: '#2563eb',
    darkColor: '#3b82f6',
  },
  {
    id: 'lavender',
    name: '薰衣',
    description: '优雅薰衣草紫，梦幻浪漫',
    lightColor: '#7c3aed',
    darkColor: '#8b5cf6',
  },
  {
    id: 'rose-pink',
    name: '玫红',
    description: '温柔玫红色，甜美细腻',
    lightColor: '#db2777',
    darkColor: '#ec4899',
  },
  {
    id: 'amber',
    name: '琥珀',
    description: '明亮琥珀黄，活力温暖',
    lightColor: '#d97706',
    darkColor: '#f59e0b',
  },
  {
    id: 'teal',
    name: '青碧',
    description: '清透青碧色，清爽明亮',
    lightColor: '#0d9488',
    darkColor: '#14b8a6',
  },
  {
    id: 'slate',
    name: '岩灰',
    description: '简约岩灰色，沉稳大气',
    lightColor: '#475569',
    darkColor: '#64748b',
  },
];

export const THEME_MODE_OPTIONS = [
  { id: 'light', name: '浅色', icon: 'sun' },
  { id: 'dark', name: '深色', icon: 'moon' },
  { id: 'auto', name: '跟随系统', icon: 'auto' },
];

export function applyThemeColors(accentColor, isDark) {
  const root = document.documentElement;
  const colors = generateThemeColors(accentColor, isDark);
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function resetThemeColors() {
  const root = document.documentElement;
  const vars = [
    '--accent-primary',
    '--accent-secondary',
    '--accent-gradient',
    '--accent-gradient-soft',
    '--accent-glow',
    '--bg-hover',
    '--bg-active',
    '--info-color',
    '--shadow-glow',
    '--shadow-glow-strong',
    '--accent-100',
    '--accent-200',
    '--accent-300',
    '--accent-400',
    '--accent-500',
    '--accent-600',
    '--accent-700',
    '--accent-800',
    '--accent-900',
  ];
  vars.forEach((v) => root.style.removeProperty(v));
}

export function getPresetById(id) {
  return THEME_PRESETS.find((p) => p.id === id) || THEME_PRESETS[0];
}

export function getAccentColorForTheme(presetId, customColor, isDark) {
  if (presetId === 'custom' && customColor) {
    return customColor;
  }
  const preset = getPresetById(presetId);
  return isDark ? preset.darkColor : preset.lightColor;
}
