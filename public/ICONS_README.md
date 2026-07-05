# 网站图标文件说明

本目录包含了知识库管理系统的所有图标文件，这些文件是自动生成的。

## 图标文件列表

### 基础图标
- `favicon.ico` - 传统的 ICO 格式 favicon (32x32)
- `favicon.png` - PNG 格式 favicon (32x32)
- `favicon.svg` - SVG 格式 favicon（矢量图标）
- `icon.svg` - 主图标 SVG 文件

### 移动端图标
- `apple-touch-icon.png` - iOS 设备图标 (180x180)
- `icon-192.png` - Android 图标 (192x192)
- `icon-512.png` - 高分辨率图标 (512x512)

### 社交媒体
- `og-image.png` - Open Graph 图片 (1200x630)

### 应用图标

## 设计说明

图标采用了知识库的核心概念设计：
- **主体**：书本图标，代表知识和文档
- **配色**：Element Plus 主题色（#409eff 到 #67c23a 的渐变）
- **风格**：现代扁平化设计，支持各种尺寸
- **背景**：圆形渐变背景，增强视觉效果

## 重新生成图标

如需重新生成图标，运行以下命令：

```bash
npm run icons:generate
```

## 浏览器支持

- ✅ Chrome/Edge - 支持所有格式
- ✅ Firefox - 支持所有格式  
- ✅ Safari - 支持所有格式
- ✅ iOS Safari - 使用 apple-touch-icon.png
- ✅ Android Chrome - 使用网页图标

## 文件大小优化

所有 PNG 图标都经过了优化，在保证质量的前提下尽可能减小文件大小。
SVG 图标使用了内联样式和优化的路径，确保快速加载。
