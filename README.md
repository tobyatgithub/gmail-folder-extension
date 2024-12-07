# Gmail Folder Organizer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Gmail Folder Organizer 是一个 Chrome 扩展程序，它能够自动将来自同一发件人的邮件组织到可折叠的文件夹中，帮助你更好地组织和管理 Gmail 收件箱。

![Gmail Folder Organizer Screenshot](screenshots/demo.png)

## ✨ 功能特点

- 🗂️ 自动将同一发件人的邮件分组到可折叠文件夹
- 📊 显示每个文件夹中的邮件数量
- 🎯 简单的一键整理功能
- 🎨 符合 Gmail 设计风格的界面
- ⚡ 轻量级实现，不影响性能

## 🚀 快速开始

### 前置要求

- Google Chrome 浏览器
- 开发者模式已启用

### 安装步骤

1. 克隆仓库：
```bash
git clone https://github.com/tobyatgithub/gmail-folder-extension.git
cd gmail-folder-extension
```

2. 在 Chrome 中加载扩展：
   - 打开 Chrome 浏览器
   - 访问 `chrome://extensions/`
   - 启用右上角的"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目文件夹

### 使用方法

1. 安装扩展后，打开 Gmail
2. 在右上角找到"整理邮件"按钮
3. 点击按钮即可自动整理邮件
4. 点击文件夹可以展开/折叠邮件列表

## 🛠️ 项目结构

```
gmail-folder-organizer/
├── manifest.json     # 扩展配置文件
├── content.js        # 主要功能实现
├── styles.css        # 样式文件
├── icon48.png        # 48x48 图标
├── icon128.png       # 128x128 图标
└── README.md         # 项目文档
```

## 🔧 开发指南

### 修改样式

修改 `styles.css` 文件来自定义文件夹的外观：

```css
.email-folder {
  /* 自定义文件夹容器样式 */
}

.folder-header {
  /* 自定义文件夹标题样式 */
}
```

### 修改功能

修改 `content.js` 文件来调整功能：

```javascript
function organizeEmails() {
  // 自定义邮件组织逻辑
}
```

## 🤝 贡献指南

欢迎贡献！请随时提交 Pull Request。对于重大更改，请先开 issue 讨论您想要更改的内容。

### 贡献步骤

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 更新日志

### [1.0.0] - 2024-12-07
- 初始版本发布
- 实现基本的邮件分组功能
- 添加可折叠文件夹界面

## ⚖️ 许可证

该项目基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙋 支持

如果您遇到任何问题或有改进建议，请：

1. 查看 [issues](https://github.com/tobyatgithub/gmail-folder-extension.git/issues) 页面
2. 如果没有找到相关问题，请创建新的 issue
3. 提供详细的问题描述和复现步骤

## 🎉 致谢

- 感谢所有贡献者对项目的支持
- 特别感谢 Gmail 团队提供的优秀邮件服务平台

## 📞 联系方式

- 项目维护者: [Your Name](https://github.com/tobyatgithub)
- Email: toby.fangyuan@gmail.com

---
⌨️ 用 ❤️ 制作