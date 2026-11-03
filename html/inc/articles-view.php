<section class="stories-wrap">
<?php if ($articleId): ?>
  <a class="stories-back" href="/articles.php"><i class="fa-solid fa-arrow-left"></i> 全部文章</a>
  <?php if (!$article): ?><div class="stories-empty"><h1>文章未公开或不存在</h1><p>返回文章列表，看看其他故事吧。</p></div>
  <?php else: ?>
  <article class="story-reading">
    <header><span class="stories-eyebrow">我们的故事</span><h1><?= e($article['title']) ?></h1><div class="story-meta"><time><?= e(substr($article['created_at'], 0, 10)) ?></time><span><?= (int)$article['views'] ?> 次阅读</span></div></header>
    <?php if ($article['cover']): ?><img class="story-cover" src="<?= e($article['cover']) ?>" alt="<?= e($article['title']) ?>"><?php endif; ?>
    <div class="story-body"><?= $article['content'] ?></div>
  </article>
  <?php endif; ?>
<?php else: ?>
  <header class="stories-heading"><div><h1><i class="fa-solid fa-book-open" aria-hidden="true"></i> 我们的故事</h1><p>把平常的日子，写成值得回看的故事。</p></div><span class="stories-count"><?= $articleTotal ?> 篇文章</span></header>
  <form class="stories-search" action="/articles.php" method="get"><label for="storyQuery" class="sr-only">搜索文章</label><input id="storyQuery" name="q" type="search" value="<?= e($articleQuery) ?>" placeholder="搜索标题或摘要"><button type="submit" aria-label="搜索文章"><i class="fa-solid fa-magnifying-glass"></i></button></form>
  <?php if ($articleRows): ?><nav class="story-months" aria-label="本页故事月份"><?php foreach (array_unique(array_map(fn($row) => substr($row['created_at'], 0, 7), $articleRows)) as $month): ?><a href="#stories-<?= e($month) ?>"><?= e(str_replace('-', ' / ', $month)) ?></a><?php endforeach; ?></nav><?php endif; ?>
  <div class="stories-grid story-timeline">
  <?php $previousMonth = ''; foreach ($articleRows as $row):
    $plain = trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($row['content']), ENT_QUOTES, 'UTF-8')));
    $excerpt = $row['excerpt'] ?: mb_substr($plain, 0, 180);
    $month = substr($row['created_at'], 0, 7);
    $minutes = max(1, (int)ceil(mb_strlen($plain) / 350));
    $cover = $row['cover'];
    if (!$cover) { $doc = new DOMDocument(); @$doc->loadHTML('<?xml encoding="utf-8" ?>' . article_safe_html($row['content'])); $firstImage = $doc->getElementsByTagName('img')->item(0); if ($firstImage) $cover = $firstImage->getAttribute('src'); }
    if ($month !== $previousMonth): $previousMonth = $month; ?>
    <h2 class="story-month" id="stories-<?= e($month) ?>"><?= e(substr($month, 0, 4)) ?><span><?= e(substr($month, 5, 2)) ?> 月</span></h2>
  <?php endif; ?>
    <article class="story-card"><time class="story-day" datetime="<?= e(substr($row['created_at'], 0, 10)) ?>"><?= e(substr($row['created_at'], 8, 2)) ?><small><?= e(substr($row['created_at'], 11, 5)) ?></small></time><a class="story-entry<?= $cover ? ' has-cover' : '' ?>" href="/articles.php?id=<?= (int)$row['id'] ?>">
      <?php if ($cover): ?><img data-lazy-skip src="<?= e($cover) ?>" alt="<?= e($row['title']) ?>" loading="lazy"><?php endif; ?>
      <div class="story-card-content"><div class="story-meta"><span><i class="fa-regular fa-clock" aria-hidden="true"></i> 约 <?= $minutes ?> 分钟</span><span><i class="fa-regular fa-eye" aria-hidden="true"></i> <?= (int)$row['views'] ?> 次阅读</span></div><h2><?= e($row['title']) ?></h2><p><?= e($excerpt) ?></p><span class="story-read-more">阅读故事 <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></div>
    </a></article>
  <?php endforeach; ?>
  </div>
  <?php if (!$articleRows): ?><div class="stories-empty"><i class="fa-regular fa-newspaper"></i><p><?= $articleQuery !== '' ? '没有找到相关故事' : '故事正在慢慢书写' ?></p></div><?php endif; ?>
  <?php if ($articleTotal > 12): ?><nav class="stories-pages" aria-label="文章分页"><?php if ($articlePage > 1): ?><a href="?<?= e(http_build_query(['q'=>$articleQuery,'page'=>$articlePage-1])) ?>">上一页</a><?php endif; ?><span><?= $articlePage ?> / <?= (int)ceil($articleTotal / 12) ?></span><?php if ($articlePage * 12 < $articleTotal): ?><a href="?<?= e(http_build_query(['q'=>$articleQuery,'page'=>$articlePage+1])) ?>">下一页</a><?php endif; ?></nav><?php endif; ?>
<?php endif; ?>
</section>
