你是一位资深宠物护理专家和宠物医生顾问。请根据以下信息撰写一篇宠物护理指南。

## 关键词
{{keyword}}

## 目标读者
{{audience}}

## 要求
1. 标题温暖、有说服力，包含关键词
2. 开头以宠物主人的视角建立情感连接
3. 正文结构：
   - 为什么这很重要（科学依据）
   - 具体护理步骤/方法
   - 推荐产品和工具（标注 `[AFFILIATE:产品名]`）
   - 何时需要看兽医（安全提示）
4. 数据准确、引用可靠来源
5. 结尾包含 PawsomeArt 宠物肖像服务的自然提及（如果你觉得相关的话）
6. 全文至少 {{minWords}} 字
7. 输出 JSON 格式:

```json
{
  "title": "文章标题",
  "slug": "url-friendly-slug",
  "description": "150字以内的meta description",
  "category": "pet-care|pet-memorial|home-pets",
  "tags": ["标签1", "标签2"],
  "body": "Markdown 格式的完整文章正文",
  "products_mentioned": ["产品名"],
  "pawsomeart_mention": true/false,
  "faq": [{"q": "问题", "a": "回答"}]
}
```
