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



## Secrets 配置

在本仓库的 `Settings → Secrets and variables → Actions` 中添加：

| 名称 | 说明 |
|------|------|
| `CONTENT_REPO_TOKEN` | 具有 `Mizuki-content` 仓库写入权限的 PAT（Personal Access Token） |
