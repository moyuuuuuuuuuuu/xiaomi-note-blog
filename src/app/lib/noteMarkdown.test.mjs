import assert from 'node:assert/strict';
import { renderNoteMarkdown, stripNoteMarkdown } from './noteMarkdown.js';

const html = renderNoteMarkdown([
  '# 标题',
  '',
  '**粗体** *斜体* ~~删除线~~',
  '- item',
  '- [x] done',
  '> quote',
  '---',
  '![图片](/data/xiaomi-images/a.bin)',
  '<script>alert(1)</script>',
  '<u>underline</u>',
  '<center>center</center>',
  '<div align="right">right</div>',
  '<span style="background-color: #ffeeaa;">mark</span>',
].join('\n'));

assert.match(html, /<h1>标题<\/h1>/);
assert.match(html, /<strong>粗体<\/strong>/);
assert.match(html, /<em>斜体<\/em>/);
assert.match(html, /<del>删除线<\/del>/);
assert.match(html, /<ul>/);
assert.match(html, /<li>item<\/li>/);
assert.match(html, /<input type="checkbox" checked disabled \/>/);
assert.match(html, /<blockquote>[\s\S]*quote[\s\S]*<\/blockquote>/);
assert.match(html, /<hr \/>/);
assert.match(html, /<img src="\/data\/xiaomi-images\/a\.bin" alt="图片" loading="lazy" \/>/);
assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.doesNotMatch(html, /<script>/);
assert.match(html, /<u>underline<\/u>/);
assert.match(html, /<center>center<\/center>/);
assert.match(html, /<div align="right">right<\/div>/);
assert.match(html, /<span style="background-color: #ffeeaa;">mark<\/span>/);

assert.equal(
  stripNoteMarkdown('# 标题 **粗体** ![图片](/data/xiaomi-images/a.bin) [链接](https://example.com)'),
  '标题 粗体 图片 链接',
);
