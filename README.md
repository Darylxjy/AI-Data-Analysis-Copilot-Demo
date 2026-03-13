<<<<<<< HEAD
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
=======
AI 数据分析助手 Demo
项目介绍

AI 数据分析助手是一个面向产品经理和运营人员的业务数据分析工具，通过结合规则引擎和大模型能力，实现业务漏斗异常识别与智能分析。

系统可以自动：

识别漏斗数据异常

分析可能原因

提供优化建议

引入业务知识库增强分析

本项目以信贷产品进件流程为例，实现了一个完整的 AI 数据分析 Copilot Demo。

核心功能
1. 业务漏斗数据分析

用户可输入信贷业务漏斗数据：

点击借款
填写信息
点击下一步
身份证验证
人脸识别
分发结果

系统自动计算：

各环节转化率

总转化率

异常环节

2. 两阶段分析流程

系统采用两阶段分析架构：

阶段1：规则层分析

计算漏斗转化率

判断是否存在异常环节

引导用户补充数据

阶段2：AI增强分析

基于规则层结果

结合补充数据

调用大模型生成分析报告

3. RAG 知识增强分析

系统内置业务知识库，包含：

漏斗环节解释

常见异常原因

优化建议

在 AI 分析阶段：

业务数据
+ 规则层分析结果
+ 补充数据
+ 知识库检索结果
↓
AI生成分析

并在结果页展示 本次参考知识，提升分析可解释性。

4. 分析结果结构化输出

AI 输出结果包括：

核心指标总结

问题识别

问题拆解

可能原因

优化建议

技术架构

前端：

Next.js
React
TypeScript
TailwindCSS

后端：

Next.js API Route
规则分析服务
RAG 检索模块

AI：

DashScope
Qwen-plus

RAG：

本地知识库
结构化检索
Prompt 注入
项目结构
src/
 ├ app/
 │   ├ input
 │   ├ supplement
 │   ├ result
 │   └ history
 ├ lib/
 │   ├ analysis
 │   └ knowledge
运行方式

安装依赖：

npm install

启动：

npm run dev

配置 AI key：

.env.local
>>>>>>> 8e2a925fb98c3f0ebbd1b268062f300327b63bc9
