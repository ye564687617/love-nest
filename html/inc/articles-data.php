<?php
require_once __DIR__ . '/article-content.php';
$articleId = max(0, (int)($_GET['id'] ?? 0));
$articlePage = max(1, (int)($_GET['page'] ?? 1));
$articleQuery = mb_substr(trim((string)($_GET['q'] ?? '')), 0, 100);
$article = null;
$articleRows = [];
$articleTotal = 0;
if ($articleId) {
    $article = db()->fetch('SELECT * FROM articles WHERE id=? AND status=1', [$articleId]);
    if (!$article) http_response_code(404);
    else {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        if (empty($_SESSION['article_views'][$articleId])) {
            db()->query('UPDATE articles SET views=views+1 WHERE id=?', [$articleId]);
            $_SESSION['article_views'][$articleId] = true;
            $article['views']++;
        }
        $article['content'] = article_safe_html($article['content']);
    }
} else {
    $params = $articleQuery !== '' ? ['%' . $articleQuery . '%', '%' . $articleQuery . '%'] : [];
    $where = 'status=1' . ($articleQuery !== '' ? ' AND (title LIKE ? OR excerpt LIKE ?)' : '');
    $articleTotal = (int)db()->fetchColumn("SELECT COUNT(*) FROM articles WHERE $where", $params);
    $articlePage = min($articlePage, max(1, (int)ceil($articleTotal / 12)));
    $offset = ($articlePage - 1) * 12;
    $articleRows = db()->fetchAll("SELECT id,title,content,cover,excerpt,views,created_at FROM articles WHERE $where ORDER BY created_at DESC,id DESC LIMIT 12 OFFSET $offset", $params);
}
