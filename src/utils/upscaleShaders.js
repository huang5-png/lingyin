const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`

const FRAGMENT_LANCZOS3 = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform vec2 u_srcSize;
uniform vec2 u_dstSize;

const float PI = 3.141592653589793;
const float RADIUS = 3.0;

float sinc(float x) {
  if (abs(x) < 0.001) return 1.0;
  float pix = x * PI;
  return sin(pix) / pix;
}

float lanczosWeight(float x) {
  if (abs(x) >= RADIUS) return 0.0;
  return sinc(x) * sinc(x / RADIUS);
}

void main() {
  vec2 texel = 1.0 / u_srcSize;
  vec2 scale = u_dstSize / u_srcSize;
  
  vec2 dstPixel = v_texCoord * u_dstSize;
  vec2 srcPixel = dstPixel / scale;
  
  vec2 srcPixelFloor = floor(srcPixel - 0.5) + 0.5;
  vec2 frac = srcPixel - srcPixelFloor;
  
  vec4 result = vec4(0.0);
  float totalWeight = 0.0;
  
  for (int y = 0; y < 7; y++) {
    float yOffset = float(y) - 3.0;
    float yWeight = lanczosWeight(frac.y + yOffset);
    
    for (int x = 0; x < 7; x++) {
      float xOffset = float(x) - 3.0;
      float xWeight = lanczosWeight(frac.x + xOffset);
      
      vec2 samplePixel = srcPixelFloor + vec2(xOffset, yOffset);
      vec2 sampleUV = samplePixel * texel;
      sampleUV = clamp(sampleUV, texel * 0.5, vec2(1.0) - texel * 0.5);
      
      float weight = xWeight * yWeight;
      result += texture2D(u_image, sampleUV) * weight;
      totalWeight += weight;
    }
  }
  
  gl_FragColor = result / max(totalWeight, 0.0001);
}
`

const FRAGMENT_LANCZOS2 = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform vec2 u_srcSize;
uniform vec2 u_dstSize;

const float PI = 3.141592653589793;
const float RADIUS = 2.0;

float sinc(float x) {
  if (abs(x) < 0.001) return 1.0;
  float pix = x * PI;
  return sin(pix) / pix;
}

float lanczosWeight(float x) {
  if (abs(x) >= RADIUS) return 0.0;
  return sinc(x) * sinc(x / RADIUS);
}

void main() {
  vec2 texel = 1.0 / u_srcSize;
  vec2 scale = u_dstSize / u_srcSize;
  
  vec2 dstPixel = v_texCoord * u_dstSize;
  vec2 srcPixel = dstPixel / scale;
  
  vec2 srcPixelFloor = floor(srcPixel - 0.5) + 0.5;
  vec2 frac = srcPixel - srcPixelFloor;
  
  vec4 result = vec4(0.0);
  float totalWeight = 0.0;
  
  for (int y = 0; y < 5; y++) {
    float yOffset = float(y) - 2.0;
    float yWeight = lanczosWeight(frac.y + yOffset);
    
    for (int x = 0; x < 5; x++) {
      float xOffset = float(x) - 2.0;
      float xWeight = lanczosWeight(frac.x + xOffset);
      
      vec2 samplePixel = srcPixelFloor + vec2(xOffset, yOffset);
      vec2 sampleUV = samplePixel * texel;
      sampleUV = clamp(sampleUV, texel * 0.5, vec2(1.0) - texel * 0.5);
      
      float weight = xWeight * yWeight;
      result += texture2D(u_image, sampleUV) * weight;
      totalWeight += weight;
    }
  }
  
  gl_FragColor = result / max(totalWeight, 0.0001);
}
`

const FRAGMENT_BICUBIC = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform vec2 u_srcSize;
uniform vec2 u_dstSize;

float cubic(float x, float b, float c) {
  x = abs(x);
  if (x < 1.0) {
    return ((12.0 - 9.0 * b - 6.0 * c) * x * x * x +
            (-18.0 + 12.0 * b + 6.0 * c) * x * x +
            (6.0 - 2.0 * b)) / 6.0;
  } else if (x < 2.0) {
    return ((-b - 6.0 * c) * x * x * x +
            (6.0 * b + 30.0 * c) * x * x +
            (-12.0 * b - 48.0 * c) * x +
            (8.0 * b + 24.0 * c)) / 6.0;
  }
  return 0.0;
}

void main() {
  vec2 texel = 1.0 / u_srcSize;
  vec2 scale = u_dstSize / u_srcSize;
  
  vec2 dstPixel = v_texCoord * u_dstSize;
  vec2 srcPixel = dstPixel / scale;
  
  vec2 srcPixelFloor = floor(srcPixel - 0.5) + 0.5;
  vec2 frac = srcPixel - srcPixelFloor;
  
  vec4 result = vec4(0.0);
  float totalX = 0.0;
  float totalY = 0.0;
  
  float weightsX[4];
  float weightsY[4];
  
  for (int i = 0; i < 4; i++) {
    float offset = float(i) - 1.0;
    float w = cubic(frac.x + offset, 0.0, 0.75);
    weightsX[i] = w;
    totalX += w;
  }
  
  for (int i = 0; i < 4; i++) {
    float offset = float(i) - 1.0;
    float w = cubic(frac.y + offset, 0.0, 0.75);
    weightsY[i] = w;
    totalY += w;
  }
  
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 samplePixel = srcPixelFloor + vec2(float(x) - 1.0, float(y) - 1.0);
      vec2 sampleUV = samplePixel * texel;
      sampleUV = clamp(sampleUV, texel * 0.5, vec2(1.0) - texel * 0.5);
      result += texture2D(u_image, sampleUV) * weightsX[x] * weightsY[y];
    }
  }
  
  gl_FragColor = result / max(totalX * totalY, 0.0001);
}
`

const FRAGMENT_ANIME4K_UPSCALE_L = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform vec2 u_srcSize;
uniform vec2 u_dstSize;
uniform float u_strength;

float getLuma(vec3 c) {
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
}

void main() {
  vec2 texel = 1.0 / u_srcSize;
  vec2 scale = u_dstSize / u_srcSize;
  
  vec2 dstPixel = v_texCoord * u_dstSize;
  vec2 srcPixel = dstPixel / scale;
  
  vec2 srcPixelFloor = floor(srcPixel - 0.5) + 0.5;
  vec2 frac = srcPixel - srcPixelFloor;
  
  vec3 c = texture2D(u_image, srcPixelFloor * texel).rgb;
  vec3 t = texture2D(u_image, (srcPixelFloor + vec2(0.0, -1.0)) * texel).rgb;
  vec3 b = texture2D(u_image, (srcPixelFloor + vec2(0.0, 1.0)) * texel).rgb;
  vec3 l = texture2D(u_image, (srcPixelFloor + vec2(-1.0, 0.0)) * texel).rgb;
  vec3 r = texture2D(u_image, (srcPixelFloor + vec2(1.0, 0.0)) * texel).rgb;
  
  vec3 tl = texture2D(u_image, (srcPixelFloor + vec2(-1.0, -1.0)) * texel).rgb;
  vec3 tr = texture2D(u_image, (srcPixelFloor + vec2(1.0, -1.0)) * texel).rgb;
  vec3 bl = texture2D(u_image, (srcPixelFloor + vec2(-1.0, 1.0)) * texel).rgb;
  vec3 br = texture2D(u_image, (srcPixelFloor + vec2(1.0, 1.0)) * texel).rgb;
  
  float lc = getLuma(c);
  float lt = getLuma(t);
  float lb = getLuma(b);
  float ll = getLuma(l);
  float lr = getLuma(r);
  float ltl = getLuma(tl);
  float ltr = getLuma(tr);
  float lbl = getLuma(bl);
  float lbr = getLuma(br);
  
  float ddx = (lr - ll) * 0.5;
  float ddy = (lb - lt) * 0.5;
  
  float dx = ltr - lbl;
  float dy = ltl - lbr;
  
  float edge = abs(dx) + abs(dy);
  float edge2 = abs(ddx) + abs(ddy);
  float maxEdge = max(edge, edge2);
  
  vec2 dir = vec2(0.0);
  if (maxEdge > 0.01) {
    if (edge > edge2) {
      dir = normalize(vec2(dx, dy) + vec2(0.0001));
    } else {
      dir = normalize(vec2(-ddy, ddx) + vec2(0.0001));
    }
  }
  
  vec2 fracOffset = frac - 0.5;
  float proj = dot(fracOffset, dir);
  
  vec3 sample1 = texture2D(u_image, (srcPixelFloor + dir * 0.5) * texel).rgb;
  vec3 sample2 = texture2D(u_image, (srcPixelFloor - dir * 0.5) * texel).rgb;
  
  float l1 = getLuma(sample1);
  float l2 = getLuma(sample2);
  
  float tVal = 0.5 + proj * u_strength * 0.5;
  tVal = clamp(tVal, 0.0, 1.0);
  
  vec3 result;
  if (maxEdge > 0.02) {
    result = mix(c, mix(sample2, sample1, tVal), min(maxEdge * 4.0, 1.0) * u_strength);
  } else {
    result = c;
  }
  
  gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
`

const FRAGMENT_ANIME4K_DARK_LINES = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform vec2 u_srcSize;
uniform float u_strength;

float getLuma(vec3 c) {
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
}

void main() {
  vec2 texel = 1.0 / u_srcSize;
  
  vec3 c = texture2D(u_image, v_texCoord).rgb;
  
  vec3 t = texture2D(u_image, v_texCoord + vec2(0.0, -texel.y)).rgb;
  vec3 b = texture2D(u_image, v_texCoord + vec2(0.0, texel.y)).rgb;
  vec3 l = texture2D(u_image, v_texCoord + vec2(-texel.x, 0.0)).rgb;
  vec3 r = texture2D(u_image, v_texCoord + vec2(texel.x, 0.0)).rgb;
  
  vec3 tl = texture2D(u_image, v_texCoord + vec2(-texel.x, -texel.y)).rgb;
  vec3 tr = texture2D(u_image, v_texCoord + vec2(texel.x, -texel.y)).rgb;
  vec3 bl = texture2D(u_image, v_texCoord + vec2(-texel.x, texel.y)).rgb;
  vec3 br = texture2D(u_image, v_texCoord + vec2(texel.x, texel.y)).rgb;
  
  float lc = getLuma(c);
  float lt = getLuma(t);
  float lb = getLuma(b);
  float ll = getLuma(l);
  float lr = getLuma(r);
  float ltl = getLuma(tl);
  float ltr = getLuma(tr);
  float lbl = getLuma(bl);
  float lbr = getLuma(br);
  
  float dx = ltr - lbl;
  float dy = ltl - lbr;
  
  float edge = abs(dx) + abs(dy);
  
  float avg = (lt + lb + ll + lr) * 0.25;
  float diff = avg - lc;
  
  vec3 result = c;
  
  if (edge > 0.03 && diff < 0.0) {
    float boost = edge * u_strength * 0.15;
    result = c - boost;
  }
  
  gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
`

const FRAGMENT_ANIME4K_THIN_LINES = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform vec2 u_srcSize;
uniform float u_strength;

float getLuma(vec3 c) {
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
}

void main() {
  vec2 texel = 1.0 / u_srcSize;
  
  vec3 c = texture2D(u_image, v_texCoord).rgb;
  
  vec3 t = texture2D(u_image, v_texCoord + vec2(0.0, -texel.y)).rgb;
  vec3 b = texture2D(u_image, v_texCoord + vec2(0.0, texel.y)).rgb;
  vec3 l = texture2D(u_image, v_texCoord + vec2(-texel.x, 0.0)).rgb;
  vec3 r = texture2D(u_image, v_texCoord + vec2(texel.x, 0.0)).rgb;
  
  float lc = getLuma(c);
  float lt = getLuma(t);
  float lb = getLuma(b);
  float ll = getLuma(l);
  float lr = getLuma(r);
  
  float dx = lr - ll;
  float dy = lb - lt;
  
  float magnitude = sqrt(dx * dx + dy * dy);
  
  float minN = min(min(lt, lb), min(ll, lr));
  float maxN = max(max(lt, lb), max(ll, lr));
  
  vec3 result = c;
  
  if (magnitude > 0.04 && lc < (minN + maxN) * 0.5) {
    float boost = magnitude * u_strength * 0.2;
    result = c - boost;
  }
  
  gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
`

const FRAGMENT_BILATERAL_SMOOTH = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform vec2 u_srcSize;
uniform float u_sigmaS;
uniform float u_sigmaR;

float getLuma(vec3 c) {
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
}

void main() {
  vec2 texel = 1.0 / u_srcSize;
  vec3 center = texture2D(u_image, v_texCoord).rgb;
  float centerLuma = getLuma(center);
  
  vec3 result = vec3(0.0);
  float totalWeight = 0.0;
  
  int radius = 3;
  
  for (int y = -3; y <= 3; y++) {
    for (int x = -3; x <= 3; x++) {
      vec2 offset = vec2(float(x), float(y)) * texel;
      vec3 sampleColor = texture2D(u_image, v_texCoord + offset).rgb;
      float sampleLuma = getLuma(sampleColor);
      
      float distSq = float(x*x + y*y) / (u_sigmaS * u_sigmaS);
      float colorDist = abs(sampleLuma - centerLuma) / u_sigmaR;
      float colorDistSq = colorDist * colorDist;
      
      float weight = exp(-0.5 * (distSq + colorDistSq));
      
      result += sampleColor * weight;
      totalWeight += weight;
    }
  }
  
  gl_FragColor = vec4(clamp(result / max(totalWeight, 0.0001), 0.0, 1.0), 1.0);
}
`

const FRAGMENT_UNSHARP_MASK = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform vec2 u_srcSize;
uniform float u_amount;
uniform float u_radius;

void main() {
  vec2 texel = 1.0 / u_srcSize;
  vec4 original = texture2D(u_image, v_texCoord);
  
  vec4 blurred = vec4(0.0);
  float totalWeight = 0.0;
  
  int radius = int(ceil(u_radius * 2.0));
  
  for (int y = -4; y <= 4; y++) {
    for (int x = -4; x <= 4; x++) {
      float fx = float(x);
      float fy = float(y);
      if (abs(fx) > u_radius * 2.0 || abs(fy) > u_radius * 2.0) continue;
      
      float distSq = (fx * fx + fy * fy) / (u_radius * u_radius);
      float weight = exp(-0.5 * distSq);
      
      vec2 offset = vec2(fx, fy) * texel;
      blurred += texture2D(u_image, v_texCoord + offset) * weight;
      totalWeight += weight;
    }
  }
  
  blurred /= max(totalWeight, 0.0001);
  
  vec4 result = original + (original - blurred) * u_amount;
  gl_FragColor = clamp(result, 0.0, 1.0);
}
`

const FRAGMENT_ADJUST = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;

float getLuma(vec3 c) {
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
}

void main() {
  vec4 color = texture2D(u_image, v_texCoord);
  
  color.rgb += u_brightness;
  
  color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
  
  float lum = getLuma(color.rgb);
  color.rgb = mix(vec3(lum), color.rgb, u_saturation);
  
  gl_FragColor = clamp(color, 0.0, 1.0);
}
`

const UPSCALE_PRESETS = {
  performance: {
    name: '性能',
    description: '双三次放大，速度最快',
    minScale: 1.0,
    filters: [
      { type: 'bicubic' }
    ],
  },
  balanced: {
    name: '平衡',
    description: 'Lanczos 2x + 轻度锐化',
    minScale: 1.5,
    filters: [
      { type: 'lanczos2' },
      { type: 'unsharp', amount: 0.4, radius: 1.0 }
    ],
  },
  quality: {
    name: '质量',
    description: 'Lanczos 3x + USM 锐化',
    minScale: 2.0,
    filters: [
      { type: 'lanczos3' },
      { type: 'unsharp', amount: 0.8, radius: 1.2 }
    ],
  },
  high: {
    name: '高',
    description: 'Lanczos 3x + 细线增强 + 锐化',
    minScale: 2.0,
    filters: [
      { type: 'lanczos3' },
      { type: 'anime4k-thin', strength: 0.6 },
      { type: 'unsharp', amount: 0.6, radius: 1.0 }
    ],
  },
  veryHigh: {
    name: '特高',
    description: 'Lanczos 3x + 双重线条增强 + 强锐化',
    minScale: 2.0,
    filters: [
      { type: 'lanczos3' },
      { type: 'anime4k-thin', strength: 0.7 },
      { type: 'anime4k-dark', strength: 0.6 },
      { type: 'unsharp', amount: 1.0, radius: 1.2 }
    ],
  },
  ultra: {
    name: '超高',
    description: '完整 Anime4K 管线 + 细节增强',
    minScale: 2.0,
    filters: [
      { type: 'lanczos3' },
      { type: 'anime4k-thin', strength: 0.7 },
      { type: 'anime4k-dark', strength: 0.8 },
      { type: 'bilateral', sigmaS: 2.0, sigmaR: 0.15 },
      { type: 'anime4k-thin', strength: 0.5 },
      { type: 'unsharp', amount: 1.1, radius: 1.5 },
      { type: 'adjust', brightness: 0.0, contrast: 1.03, saturation: 1.05 }
    ],
  },
  highest: {
    name: '最高',
    description: '旗舰级：全流程增强 + 细节恢复',
    minScale: 2.0,
    filters: [
      { type: 'lanczos3' },
      { type: 'anime4k-thin', strength: 0.8 },
      { type: 'anime4k-dark', strength: 0.9 },
      { type: 'bilateral', sigmaS: 2.5, sigmaR: 0.12 },
      { type: 'anime4k-thin', strength: 0.7 },
      { type: 'anime4k-dark', strength: 0.6 },
      { type: 'unsharp', amount: 1.3, radius: 1.5 },
      { type: 'adjust', brightness: 0.0, contrast: 1.05, saturation: 1.08 }
    ],
  },
  anime: {
    name: '动漫优化',
    description: '专为动漫画风优化的管线',
    minScale: 2.0,
    filters: [
      { type: 'lanczos3' },
      { type: 'anime4k-thin', strength: 0.75 },
      { type: 'anime4k-dark', strength: 0.85 },
      { type: 'bilateral', sigmaS: 2.0, sigmaR: 0.1 },
      { type: 'anime4k-thin', strength: 0.6 },
      { type: 'unsharp', amount: 0.9, radius: 1.3 },
      { type: 'adjust', brightness: 0.0, contrast: 1.04, saturation: 1.06 }
    ],
  },
  soft: {
    name: '柔和',
    description: '柔和放大，不过度锐化',
    minScale: 1.5,
    filters: [
      { type: 'lanczos2' },
      { type: 'bilateral', sigmaS: 1.5, sigmaR: 0.2 },
      { type: 'unsharp', amount: 0.3, radius: 1.0 }
    ],
  },
}

class WebGLUpscaler {
  constructor() {
    this.gl = null
    this.programs = {}
    this.quadBuffer = null
    this.textures = []
    this.framebuffers = []
  }

  init(canvas) {
    const gl = canvas.getContext('webgl', {
      preserveDrawingBuffer: false,
      antialias: false,
      alpha: true,
    })
    if (!gl) {
      console.warn('WebGL 不可用，回退到 Canvas 2D')
      return null
    }
    this.gl = gl

    this._createQuadBuffer()

    return gl
  }

  _createQuadBuffer() {
    const gl = this.gl
    const positions = new Float32Array([
      -1, -1, 0, 1,
      1, -1, 1, 1,
      -1, 1, 0, 0,
      1, 1, 1, 0,
    ])
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
    this.quadBuffer = buffer
  }

  _createShader(type, source) {
    const gl = this.gl
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader 编译错误:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    return shader
  }

  _getProgram(fragmentSource) {
    if (this.programs[fragmentSource]) {
      return this.programs[fragmentSource]
    }

    const gl = this.gl
    const vertexShader = this._createShader(gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragmentShader = this._createShader(gl.FRAGMENT_SHADER, fragmentSource)
    if (!vertexShader || !fragmentShader) return null

    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program 链接错误:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return null
    }

    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    this.programs[fragmentSource] = program
    return program
  }

  _createTexture(width, height) {
    const gl = this.gl
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    return texture
  }

  _createFramebuffer(texture) {
    const gl = this.gl
    const framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    return framebuffer
  }

  _getTempTexture(index, width, height) {
    if (!this.textures[index] || 
        this.textures[index].width !== width || 
        this.textures[index].height !== height) {
      if (this.textures[index]) {
        this.gl.deleteTexture(this.textures[index])
        this.gl.deleteFramebuffer(this.framebuffers[index])
      }
      const tex = this._createTexture(width, height)
      tex.width = width
      tex.height = height
      this.textures[index] = tex
      this.framebuffers[index] = this._createFramebuffer(tex)
      return tex
    }
    return this.textures[index]
  }

  _drawQuad(program, texture, srcWidth, srcHeight, dstWidth, dstHeight, uniforms) {
    const gl = this.gl
    gl.useProgram(program)

    const positionLoc = gl.getAttribLocation(program, 'a_position')
    const texCoordLoc = gl.getAttribLocation(program, 'a_texCoord')

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(texCoordLoc)
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    const imageLoc = gl.getUniformLocation(program, 'u_image')
    if (imageLoc) gl.uniform1i(imageLoc, 0)

    const srcSizeLoc = gl.getUniformLocation(program, 'u_srcSize')
    if (srcSizeLoc) gl.uniform2f(srcSizeLoc, srcWidth, srcHeight)

    const dstSizeLoc = gl.getUniformLocation(program, 'u_dstSize')
    if (dstSizeLoc) gl.uniform2f(dstSizeLoc, dstWidth, dstHeight)

    if (uniforms) {
      for (const [name, value] of Object.entries(uniforms)) {
        const loc = gl.getUniformLocation(program, name)
        if (!loc) continue
        if (typeof value === 'number') {
          gl.uniform1f(loc, value)
        } else if (Array.isArray(value) && value.length === 2) {
          gl.uniform2f(loc, value[0], value[1])
        }
      }
    }

    gl.viewport(0, 0, dstWidth, dstHeight)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  upscale(image, targetCanvas, presetName = 'high', targetWidth = null, targetHeight = null) {
    const config = UPSCALE_PRESETS[presetName] || UPSCALE_PRESETS.high
    const { filters, minScale } = config

    const srcWidth = image.naturalWidth || image.width
    const srcHeight = image.naturalHeight || image.height

    let finalWidth, finalHeight
    if (targetWidth && targetHeight) {
      finalWidth = Math.max(1, Math.round(targetWidth))
      finalHeight = Math.max(1, Math.round(targetHeight))
    } else {
      const scale = minScale || 2
      finalWidth = Math.max(1, Math.round(srcWidth * scale))
      finalHeight = Math.max(1, Math.round(srcHeight * scale))
    }

    const aspectRatio = srcWidth / srcHeight
    if (targetWidth && !targetHeight) {
      finalWidth = targetWidth
      finalHeight = Math.round(targetWidth / aspectRatio)
    } else if (targetHeight && !targetWidth) {
      finalHeight = targetHeight
      finalWidth = Math.round(targetHeight * aspectRatio)
    }

    targetCanvas.width = finalWidth
    targetCanvas.height = finalHeight

    const gl = this.init(targetCanvas)
    if (!gl) {
      return this._fallbackCanvas2D(image, targetCanvas, finalWidth, finalHeight)
    }

    const inputTexture = this._createTexture(srcWidth, srcHeight)
    inputTexture.width = srcWidth
    inputTexture.height = srcHeight
    gl.bindTexture(gl.TEXTURE_2D, inputTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)

    let currentTexture = inputTexture
    let currentWidth = srcWidth
    let currentHeight = srcHeight
    let tempIndex = 0

    const getFilterShader = (filterType) => {
      switch (filterType) {
        case 'lanczos3': return FRAGMENT_LANCZOS3
        case 'lanczos2': return FRAGMENT_LANCZOS2
        case 'bicubic': return FRAGMENT_BICUBIC
        case 'anime4k-thin': return FRAGMENT_ANIME4K_THIN_LINES
        case 'anime4k-dark': return FRAGMENT_ANIME4K_DARK_LINES
        case 'bilateral': return FRAGMENT_BILATERAL_SMOOTH
        case 'unsharp': return FRAGMENT_UNSHARP_MASK
        case 'adjust': return FRAGMENT_ADJUST
        default: return null
      }
    }

    const getFilterUniforms = (filter) => {
      const { type, ...params } = filter
      switch (type) {
        case 'anime4k-thin':
        case 'anime4k-dark':
          return { u_strength: params.strength || 0.6 }
        case 'bilateral':
          return { u_sigmaS: params.sigmaS || 2.0, u_sigmaR: params.sigmaR || 0.15 }
        case 'unsharp':
          return { u_amount: params.amount || 0.8, u_radius: params.radius || 1.0 }
        case 'adjust':
          return {
            u_brightness: params.brightness || 0.0,
            u_contrast: params.contrast || 1.0,
            u_saturation: params.saturation || 1.0
          }
        default:
          return {}
      }
    }

    const isScalingFilter = (type) => {
      return type === 'lanczos3' || type === 'lanczos2' || type === 'bicubic'
    }

    const activeFilters = filters || []

    for (let i = 0; i < activeFilters.length; i++) {
      const filter = activeFilters[i]
      const shader = getFilterShader(filter.type)
      if (!shader) continue

      const program = this._getProgram(shader)
      if (!program) continue

      const isScaling = isScalingFilter(filter.type)
      const outWidth = isScaling ? finalWidth : currentWidth
      const outHeight = isScaling ? finalHeight : currentHeight
      const isLast = i === activeFilters.length - 1

      const uniforms = getFilterUniforms(filter)

      if (isLast) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        this._drawQuad(program, currentTexture, currentWidth, currentHeight, outWidth, outHeight, uniforms)
      } else {
        const tempTex = this._getTempTexture(tempIndex, outWidth, outHeight)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[tempIndex])
        this._drawQuad(program, currentTexture, currentWidth, currentHeight, outWidth, outHeight, uniforms)

        currentTexture = tempTex
        currentWidth = outWidth
        currentHeight = outHeight
        tempIndex = 1 - tempIndex
      }
    }

    gl.deleteTexture(inputTexture)

    gl.flush()
    return true
  }

  _fallbackCanvas2D(image, targetCanvas, targetWidth, targetHeight) {
    const ctx = targetCanvas.getContext('2d')
    if (!ctx) return false

    targetCanvas.width = targetWidth
    targetCanvas.height = targetHeight

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

    return true
  }

  dispose() {
    const gl = this.gl
    if (!gl) return

    for (const program of Object.values(this.programs)) {
      gl.deleteProgram(program)
    }
    this.programs = {}

    for (const tex of this.textures) {
      if (tex) gl.deleteTexture(tex)
    }
    this.textures = []

    for (const fb of this.framebuffers) {
      if (fb) gl.deleteFramebuffer(fb)
    }
    this.framebuffers = []

    if (this.quadBuffer) {
      gl.deleteBuffer(this.quadBuffer)
      this.quadBuffer = null
    }
  }
}

const globalUpscaler = new WebGLUpscaler()

export function upscaleImage(image, targetCanvas, presetName = 'high', targetWidth = null, targetHeight = null) {
  try {
    return globalUpscaler.upscale(image, targetCanvas, presetName, targetWidth, targetHeight)
  } catch (e) {
    console.warn('WebGL 超分失败，回退到 Canvas 2D:', e)
    const srcWidth = image.naturalWidth || image.width
    const srcHeight = image.naturalHeight || image.height
    const config = UPSCALE_PRESETS[presetName] || UPSCALE_PRESETS.high
    const scale = config.minScale || 2

    const tw = targetWidth || Math.round(srcWidth * scale)
    const th = targetHeight || Math.round(srcHeight * scale)

    targetCanvas.width = tw
    targetCanvas.height = th
    const ctx = targetCanvas.getContext('2d')
    if (!ctx) return false

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, 0, 0, tw, th)
    return true
  }
}

export function getPresetList() {
  return Object.entries(UPSCALE_PRESETS).map(([key, value]) => ({
    key,
    ...value,
  }))
}

export { UPSCALE_PRESETS }
