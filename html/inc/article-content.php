<?php
// Share the same HTML policy between editor saves and public rendering.
function article_safe_html(string $html): string
{
    $doc = new DOMDocument('1.0', 'UTF-8');
    $old = libxml_use_internal_errors(true);
    $doc->loadHTML('<?xml encoding="UTF-8"><div id="article-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($old);
    $allowed = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'a', 'img', 'span', 'div', 'hr', 'figure', 'figcaption'];
    $clean = function (DOMNode $parent) use (&$clean, $allowed): void {
        foreach (iterator_to_array($parent->childNodes) as $node) {
            if ($node instanceof DOMComment || $node instanceof DOMProcessingInstruction) { $parent->removeChild($node); continue; }
            if (!$node instanceof DOMElement) continue;
            $tag = strtolower($node->tagName);
            if (in_array($tag, ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button', 'meta', 'link', 'base'], true)) { $parent->removeChild($node); continue; }
            $clean($node);
            if (!in_array($tag, $allowed, true)) {
                while ($node->firstChild) $parent->insertBefore($node->firstChild, $node);
                $parent->removeChild($node); continue;
            }
            foreach (iterator_to_array($node->attributes) as $attr) {
                $name = strtolower($attr->name); $value = $attr->value;
                $keep = in_array($name, ['alt', 'title'], true);
                if ($tag === 'img' && $name === 'src') $keep = site_valid_media_url($value);
                if ($tag === 'a' && $name === 'href') $keep = preg_match('~^(https?://|mailto:|/(?!/)|#)~i', $value) === 1 && !preg_match('/[\x00-\x20]/', $value);
                if ($name === 'class') {
                    $classes = array_filter(explode(' ', $value), fn($class) => preg_match('/^ql-(align-(center|right|justify)|indent-[1-8]|syntax|code-block|code-block-container)$/D', $class));
                    $node->setAttribute('class', implode(' ', $classes)); $keep = true;
                }
                if ($tag === 'li' && $name === 'data-list') $keep = in_array($value, ['ordered', 'bullet'], true);
                if (!$keep) $node->removeAttribute($attr->name);
            }
            if ($tag === 'img') { if (!$node->hasAttribute('src')) { $parent->removeChild($node); continue; } $node->setAttribute('loading', 'lazy'); }
            if ($tag === 'a') $node->setAttribute('rel', 'noopener noreferrer');
        }
    };
    $root = $doc->getElementById('article-root');
    if (!$root) return '';
    $clean($root);
    $out = ''; foreach ($root->childNodes as $child) $out .= $doc->saveHTML($child);
    return $out;
}
