#!/usr/bin/env node
/**
 * build-friends.js
 * 扫描所有「审核通过」的 Issue，提取字段，生成 friends.ts
 *
 * 环境变量（由 Actions workflow 传入）：
 *   GH_TOKEN          - GitHub Token，用于调用 API
 *   ISSUES_REPO       - 友链管理仓库，格式：owner/repo
 *   APPROVED_LABEL    - 审核通过的标签名
 *   OWNER_LOGIN       - 仓库 Owner 的 GitHub 用户名，用于识别 /tags 指令
 *   DEFAULT_TAGS      - 默认 tags，JSON 数组字符串，如 '["朋友们"]'
 *   OUTPUT_FILE       - 输出文件路径
 */

import { execSync } from "child_process";
import fs from "fs";

// ─── 读取环境变量 ────────────────────────────────────────────────────────────
const GH_TOKEN       = process.env.GH_TOKEN;
const ISSUES_REPO    = process.env.ISSUES_REPO;
const APPROVED_LABEL = process.env.APPROVED_LABEL;
const OWNER_LOGIN    = process.env.OWNER_LOGIN;
const DEFAULT_TAGS   = JSON.parse(process.env.DEFAULT_TAGS || '["朋友们"]');
const OUTPUT_FILE    = process.env.OUTPUT_FILE || "friends.ts";

if (!GH_TOKEN || !ISSUES_REPO || !APPROVED_LABEL || !OWNER_LOGIN) {
  console.error("❌ 缺少必要的环境变量，请检查 workflow 配置");
  process.exit(1);
}

// ─── GitHub API 请求封装 ─────────────────────────────────────────────────────
function ghApi(path) {
  const result = execSync(
    `gh api "${path}" --paginate`,
    { env: { ...process.env, GH_TOKEN }, encoding: "utf-8" }
  );
  return JSON.parse(result);
}

// ─── 提取 Issue 表单字段 ─────────────────────────────────────────────────────
// GitHub Issue 表单提交后的 body 格式固定如下：
// ### 字段标题
// 字段内容
function parseIssueBody(body) {
  const fields = {};
  if (!body) return fields;

  // 按 "### " 分割各字段块
  const blocks = body.split(/^### /m).filter(Boolean);
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim());
    const key = lines[0].trim();
    // 内容为 key 之后第一个非空行
    const value = lines.slice(1).find((l) => l.length > 0) || "";
    fields[key] = value;
  }
  return fields;
}

// ─── 从 Owner 评论中提取 /tags 指令 ─────────────────────────────────────────
// 格式：/tags: 朋友们, 技术
// 只信任 OWNER_LOGIN 的评论
function extractTagsFromComments(comments) {
  // 从最新评论往前找，取最后一条 owner 的指令
  const ownerComments = comments
    .filter((c) => c.user.login === OWNER_LOGIN)
    .reverse();

  for (const comment of ownerComments) {
    const match = comment.body.match(/^\/tags:\s*(.+)$/m);
    if (match) {
      return match[1]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return null; // 无指令，使用默认值
}

// ─── 生成 friends.ts 文件内容 ────────────────────────────────────────────────
function generateFriendsTs(items) {
  const itemsCode = items
    .map(
      (item) => `\t{
\t\tid: ${item.id},
\t\ttitle: ${JSON.stringify(item.title)},
\t\timgurl: ${JSON.stringify(item.imgurl)},
\t\tdesc: ${JSON.stringify(item.desc)},
\t\tsiteurl: ${JSON.stringify(item.siteurl)},
\t\ttags: ${JSON.stringify(item.tags)},
\t}`
    )
    .join(",\n");

  return `// 友情链接数据配置
// ⚠️ 此文件由 GitHub Actions 自动生成，请勿手动修改
// 数据来源：https://github.com/${ISSUES_REPO}

export interface FriendItem {
\tid: number;
\ttitle: string;
\timgurl: string;
\tdesc: string;
\tsiteurl: string;
\ttags: string[];
}

// 友情链接数据
export const friendsData: FriendItem[] = [
${itemsCode}
];

// 获取所有友情链接数据
export function getFriendsList(): FriendItem[] {
\treturn friendsData;
}

// 获取随机排序的友情链接数据
export function getShuffledFriendsList(): FriendItem[] {
\tconst shuffled = [...friendsData];
\tfor (let i = shuffled.length - 1; i > 0; i--) {
\t\tconst j = Math.floor(Math.random() * (i + 1));
\t\t[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
\t}
\treturn shuffled;
}
`;
}

// ─── 主流程 ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`📋 开始扫描仓库：${ISSUES_REPO}`);
  console.log(`🏷️  目标标签：${APPROVED_LABEL}`);
  console.log(`👤 Owner：${OWNER_LOGIN}\n`);

  // 1. 拉取所有「审核通过」且 open 状态的 Issue
  const issues = ghApi(
    `/repos/${ISSUES_REPO}/issues?labels=${encodeURIComponent(APPROVED_LABEL)}&state=open&per_page=100`
  );

  console.log(`✅ 共找到 ${issues.length} 条审核通过的友链 Issue`);

  if (issues.length === 0) {
    console.log("⚠️  无有效友链，将生成空列表");
  }

  // 2. 逐条处理 Issue
  const friendItems = [];
  for (const issue of issues) {
    console.log(`\n🔍 处理 Issue #${issue.number}：${issue.title}`);

    // 解析表单字段
    const fields = parseIssueBody(issue.body);
    const title   = fields["站点名称"];
    const siteurl = fields["站点链接"];
    const imgurl  = fields["头像链接"];
    const desc    = fields["站点描述"];

    // 校验必填字段
    if (!title || !siteurl || !imgurl || !desc) {
      console.warn(`   ⚠️  字段不完整，跳过此 Issue（缺少：${
        [!title && "站点名称", !siteurl && "站点链接", !imgurl && "头像链接", !desc && "站点描述"]
          .filter(Boolean).join("、")
      }）`);
      continue;
    }

    // 读取评论，提取 /tags 指令
    const comments = ghApi(`/repos/${ISSUES_REPO}/issues/${issue.number}/comments`);
    const tags = extractTagsFromComments(comments) ?? DEFAULT_TAGS;

    console.log(`   📌 title：${title}`);
    console.log(`   🔗 siteurl：${siteurl}`);
    console.log(`   🖼️  imgurl：${imgurl}`);
    console.log(`   📝 desc：${desc}`);
    console.log(`   🏷️  tags：${tags.join(", ")}`);

    friendItems.push({
      id: issue.number,
      title,
      siteurl,
      imgurl,
      desc,
      tags,
    });
  }

  // 3. 生成文件内容
  const tsContent = generateFriendsTs(friendItems);

  // 4. 写入输出文件
  fs.writeFileSync(OUTPUT_FILE, tsContent, "utf-8");
  console.log(`\n📄 已生成文件：${OUTPUT_FILE}`);
  console.log(`   共收录 ${friendItems.length} 条友链`);
}

main().catch((err) => {
  console.error("❌ 构建失败：", err.message);
  process.exit(1);
});
