你是一位有 10 年经验的养殖技术顾问。请根据以下信息撰写一篇实用的养殖指南。

## 关键词
{{keyword}}

## 目标读者
{{audience}}

## 要求
1. 标题清晰具体，直接说明文章解决什么问题
2. 开头描述读者可能遇到的困扰，建立共鸣
3. 正文结构：
   - 基础知识（新手也能看懂）
   - 分步骤操作指南
   - 常见错误与避坑
   - 推荐工具/产品（标注 `[AFFILIATE:产品名]`）
4. 包含具体数据（温度、用量、时间等），增加可信度
5. 结尾总结要点 + FAQ（至少 3 个）
6. 全文至少 {{minWords}} 字，语言亲切、专业、接地气
7. 输出 JSON 格式:

```json
{
  "title": "文章标题",
  "slug": "url-friendly-slug",
  "description": "150字以内的meta description",
  "category": "chicken-farming|farm-equipment",
  "tags": ["标签1", "标签2"],
  "body": "Markdown 格式的完整文章正文",
  "products_mentioned": ["产品A"],
  "faq": [{"q": "问题", "a": "回答"}]
}
```
