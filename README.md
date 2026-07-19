# firends-data

Mizuki Blog 友链管理仓库，通过 GitHub Issue 申请友链，由 GitHub Actions 自动生成数据文件。

---

## 申请友链

点击 [New Issue](../../issues/new/choose) 选择「友链申请」模板，按提示填写信息提交即可。

提交后状态流转如下：

```
提交 Issue → 自动打「待审核」标签
                │
                ├─ 审核通过 → 手动改为「审核通过」→ Actions 自动构建 → 收录进博客
                └─ 审核拒绝 → 手动打「审核拒绝」标签 / 关闭 Issue → 不收录
```

---

## 标签说明

| 标签 | 含义 |
|------|------|
| 待审核 | 初始状态，等待审核 |
| 审核通过 | 将被收录，触发自动构建 |
| 审核拒绝 | 不予收录 |

---

## 对于博主（Owner 操作说明）

### 指定友链分类（tags）

在 Issue 评论区留一条如下格式的评论，Actions 构建时会自动读取：

```
/tags: 朋友们
```

多个分类用逗号分隔：

```
/tags: 朋友们, 技术
```

- 只有 **仓库 Owner** 的评论中的 `/tags` 指令会被识别
- 如果没有留任何指令，默认使用 `["朋友们"]`
- 如果留了多条指令，以**最新一条**为准

### 移除友链

直接**关闭对应 Issue**，下次有其他 Issue 触发 Actions 构建时，该友链会自动从数据文件中移除。

若需立即生效，可手动在 Actions 页面触发一次 `workflow_dispatch`（需在 workflow 中启用，默认未启用）。

---

## 仓库结构

```
firends-data/
├── config.yml                              # 可配置项（标签名、目标仓库等）
├── README.md
└── .github/
    ├── ISSUE_TEMPLATE/
    │   └── friend-request.yml              # 友链申请表单模板
    ├── scripts/
    │   └── build-friends.js               # 构建脚本（生成 friends.ts）
    └── workflows/
        └── build-friends.yml              # Actions workflow
```

---

## Secrets 配置

在本仓库的 `Settings → Secrets and variables → Actions` 中添加：

| 名称 | 说明 |
|------|------|
| `CONTENT_REPO_TOKEN` | 具有 `Mizuki-content` 仓库写入权限的 PAT（Personal Access Token） |
