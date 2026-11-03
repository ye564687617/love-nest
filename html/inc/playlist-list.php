<?php $songs = site_playlist(); ?>
        <div class="pl-list-header">
            <span class="pl-list-title"><svg class="iconfont icon-yinyue" aria-hidden="true"><use href="#icon-yinyue" xlink:href="#icon-yinyue"></use></svg> 歌单列表</span>
            <span class="pl-list-count"><?= count($songs) ?>首</span>
        </div>
        <div class="pl-list" id="plList">
            <?php foreach ($songs as $index => $song): ?>
            <div class="pl-song" onclick="_plPlaySong(<?= $index ?>)">
                <div class="pl-song-idx"><?= $index + 1 ?></div>
                <img class="pl-song-cover" src="<?= e($song['cover'] ?: '/static/image/1.png') ?>" alt="" loading="lazy">
                <div class="pl-song-info">
                    <div class="pl-song-name"><?= e($song['name']) ?></div>
                    <div class="pl-song-artist"><?= e($song['artist']) ?></div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
