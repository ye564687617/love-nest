const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../html');
const source = fs.readFileSync(path.join(root, 'games.php'), 'utf8');
if (!fs.existsSync(path.join(root, 'articles.php'))) {
  const start = source.indexOf('    <!-- 游戏内容 -->');
  const closing = '    </div><!-- /#pjax-container -->';
  const end = source.indexOf(closing, start) + closing.length;
  if (start < 0 || end < closing.length) throw new Error('Public shell anchors missing');
  let page = source.slice(0, start) + '    <div id="pjax-container">\n<?php require __DIR__ . "/inc/articles-view.php"; ?>\n    </div>' + source.slice(end);
  page = page.replace('$cfg = site_cfg(); ?>', '$cfg = site_cfg(); require __DIR__ . "/inc/articles-data.php"; ?>');
  page = page.replace('情侣游戏 —', '我们的故事 —');
  page = page.replace('static/css/games.css?v=1', 'static/css/articles.css?v=20261030-1');
  page = page.replace(/^.*<script src="static\/(?:data\/quiz-questions|js\/games\/[^"?]+)\.js[^\n]*\n/gm, '');
  fs.writeFileSync(path.join(root, 'articles.php'), page);
}
for (const name of fs.readdirSync(root).filter(name => name.endsWith('.php'))) {
  if (name === 'games.php') continue;
  const file = path.join(root, name);
  let text = fs.readFileSync(file, 'utf8');
  text = text.replaceAll('href="games.php"', 'href="articles.php"').replaceAll('class="nav-text">游戏<', 'class="nav-text">文章<').replaceAll('class="mobile-nav-label">游戏<', 'class="mobile-nav-label">文章<');
  fs.writeFileSync(file, text);
}
