(function () {
    'use strict';

    if (window.nfx_episodes_plugin) return;
    window.nfx_episodes_plugin = true;

    var PLUGIN_NAME = 'Netflix Episodes 5';

    /* ------------------------------ styles (True Fullscreen & HD) ------------------------------ */

    var CSS = `
.nfx-fullscreen-modal {
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    max-height: none !important;
    top: 0 !important;
    left: 0 !important;
    border-radius: 0 !important;
    transform: none !important;
    background: #111115 !important;
}
.nfx-fullscreen-modal .modal__body {
    width: 100% !important;
    height: 100% !important;
    box-sizing: border-box !important;
    padding: 0 !important;
}

.nfx-episodes{
    padding: 2em 3em 2.5em;
    background: #111115;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}
.nfx-episodes__strip-wrap{
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    margin: 0 -3em;
    padding: 0.8em 3em;
    white-space: nowrap;
    flex-shrink: 0;
}
.nfx-episodes__strip-wrap::-webkit-scrollbar{ display: none; }
.nfx-episodes__strip{
    display: flex;
    align-items: center;
}
.nfx-episodes__strip > * {
    margin-right: 1em;
}
.nfx-episodes__strip > *:last-child {
    margin-right: 0;
}
.nfx-season{
    flex: 0 0 auto;
    font-size: 1.2em;
    font-weight: 800;
    text-transform: uppercase;
    color: #aaaaaa;
    padding: 0.8em 1.2em;
    background: #1e1e24;
    border-radius: 0.5em;
    user-select: none;
    letter-spacing: 0.08em;
}
.nfx-card{
    flex: 0 0 auto;
    width: 14em;
    padding: 1.3em 1.1em 1.1em;
    border-radius: 0.6em;
    background: #25252c;
    border: 2px solid #3a3a44;
    cursor: pointer;
    box-sizing: border-box;
}
.nfx-card.focus{
    background: #3b3b47;
    border-color: #ffffff;
    transform: scale(1.06);
}
.nfx-card__num{
    font-size: 2.5em;
    font-weight: 800;
    line-height: 1;
    color: #ffffff;
    margin-bottom: 0.4em;
}
.nfx-card__name{
    font-size: 1.15em;
    font-weight: 500;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    height: 2.6em;
    color: #dddddd;
    white-space: normal;
}
.nfx-card.focus .nfx-card__name{ 
    color: #ffffff; 
}
.nfx-card--watched{ opacity: 0.5; }
.nfx-card--file .nfx-card__num{
    font-size: 1.4em;
    font-weight: 600;
}

.nfx-detail{
    display: flex;
    margin-top: 1.5em;
    align-items: flex-start;
    flex: 1;
}
.nfx-detail > * {
    margin-right: 2.5em;
}
.nfx-detail > *:last-child {
    margin-right: 0;
}
.nfx-detail__img{
    flex: 0 0 auto;
    width: 32em;
    height: 18em;
    border-radius: 0.6em;
    overflow: hidden;
    background: #1a1a1a;
    position: relative;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
.nfx-detail__img img{
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0;
    transition: opacity .3s;
}
.nfx-detail__img img.loaded{ opacity: 1; }
.nfx-detail__img-empty{
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3em;
    font-weight: 700;
    color: #555555;
    background: #1c1f24;
}
.nfx-detail__body{ 
    min-width: 0; 
    flex: 1; 
}
.nfx-detail__title{
    font-size: 2.2em;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 0.4em;
    color: #ffffff;
}
.nfx-detail__meta{
    font-size: 1.2em;
    font-weight: 400;
    color: #aaaaaa;
    margin-bottom: 1em;
}
.nfx-detail__meta span + span::before{
    content: ' • ';
    opacity: 0.6;
}
.nfx-detail__meta .nfx-detail__size{
    background: #333333;
    color: #ffffff;
    border-radius: 0.3em;
    padding: 0.1em 0.6em;
}
.nfx-detail__overview{
    font-size: 1.25em;
    font-weight: 400;
    line-height: 1.6;
    color: #dddddd;
    max-width: 65em;
    white-space: normal;
}
.nfx-detail__overview--empty{ opacity: 0.45; font-style: italic; }
`;

    var pairs = [];
    var ui = null;
    var detail = null;
    var active = false;
    var built = false;
    var serial_decided = false;
    var is_serial = false;
    var retry_timer = null;
    var fallback_timer = null;
    var params_ref = null;
    var modal_ref = null;
    var modal_observer = null;

    function esc(s) {
        try {
            return $('<div>').text(s == null ? '' : s).html();
        } catch (e) {
            return '';
        }
    }

    function isEpisodeElement(el) {
        return !!(el && el.season != null && el.episode != null && el.episode !== '');
    }

    function hasValidSeasons(params) {
        if (!params || !params.seasons) return false;
        var keys = Object.keys(params.seasons);
        return keys.length > 0;
    }

    function episodesArrayFor(seasonNum, params) {
        if (!params || !params.seasons || seasonNum == null) return null;
        var node = params.seasons[seasonNum];
        if (!node) return null;
        if (Array.isArray(node)) return node;
        if (Array.isArray(node.episodes)) return node.episodes;
        return null;
    }

    function findEpisodeMeta(element, params) {
        var list = episodesArrayFor(element && element.season, params);
        if (!list) return null;
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].episode_number == element.episode) return list[i];
        }
        return null;
    }

    function cardHtml(pair) {
        var el = pair.element;
        var isEp = isEpisodeElement(el);

        var num = isEp
            ? (String(el.episode).length < 2 ? '0' + el.episode : String(el.episode))
            : '';
        var meta = isEp ? findEpisodeMeta(el, params_ref) : null;
        var name = isEp
            ? ((meta && meta.name) || el.fname || el.title || el.path_human || '')
            : (el.title || el.path_human || el.path || 'Файл');

        var cls = 'nfx-card selector' + (isEp ? '' : ' nfx-card--file');
        if (el.viewed_percent || el.viewed_time) cls += ' nfx-card--watched';

        return $('<div class="' + cls + '">' +
            '<div class="nfx-card__num">' + esc(num || '▸') + '</div>' +
            '<div class="nfx-card__name">' + esc(name) + '</div>' +
        '</div>');
    }

    function seasonLabel(el) {
        return isEpisodeElement(el) ? 'Сезон ' + el.season : 'Прочее';
    }

    function updateDetail(pair) {
        if (!detail || !detail.length) return;
        var el = pair.element;
        var meta = findEpisodeMeta(el, params_ref);
        var isEp = isEpisodeElement(el);

        var img = '';
        try {
            if (el.img) {
                img = el.img;
            } else if (meta && meta.still_path) {
                if (window.Lampa && Lampa.Api && Lampa.Api.img) {
                    img = Lampa.Api.img(meta.still_path, 'original');
                } else {
                    img = 'https://image.tmdb.org/t/p/original' + meta.still_path;
                }
            }
        } catch (e) {}

        var title = isEp
            ? ((meta && meta.name) || el.fname || el.title || ('Эпизод ' + el.episode))
            : (el.title || el.path_human || el.path || 'Файл');

        var metaBits = [];
        if (isEp) metaBits.push('<span>Сезон ' + esc(el.season) + ' • Серия ' + esc(el.episode) + '</span>');
        var air = el.air_date || (meta && meta.air_date);
        if (air) metaBits.push('<span>' + esc(air) + '</span>');
        if (el.size) metaBits.push('<span class="nfx-detail__size">' + esc(el.size) + '</span>');
        if (meta && meta.runtime) metaBits.push('<span>' + esc(meta.runtime) + ' мин</span>');

        var overview = (meta && meta.overview) || el.overview || '';

        detail.find('.nfx-detail__title').html(esc(title));
        detail.find('.nfx-detail__meta').html(metaBits.join(' '));

        var ov = detail.find('.nfx-detail__overview');
        if (overview) {
            ov.removeClass('nfx-detail__overview--empty').text(overview);
        } else {
            ov.addClass('nfx-detail__overview--empty')
              .text(isEp ? 'Описание серии отсутствует.' : 'Дополнительная информация недоступна.');
        }

        var imgBox = detail.find('.nfx-detail__img');
        imgBox.empty();
        var fallbackHtml = '<div class="nfx-detail__img-empty">' +
            esc(isEp ? 'S' + el.season + 'E' + el.episode : '?') + '</div>';
        if (img) {
            var $img = $('<img alt="">').on('load', function () { $(this).addClass('loaded'); })
                                       .on('error', function () { imgBox.html(fallbackHtml); });
            imgBox.append($img);
            $img.attr('src', img);
        } else {
            imgBox.html(fallbackHtml);
        }
    }

    function findModal() {
        if (modal_ref && modal_ref.length && modal_ref.closest('body').length) return modal_ref;
        var m = $('.modal:visible').last();
        if (!m.length) m = $('.modal').last();
        return m.length ? m : null;
    }

    function findFilesBox(modal) {
        if (!modal || !modal.length) return $();
        var box = modal.find('.torrent-files').first();
        return box.length ? box : $();
    }

    function anyEpisodes() {
        if (!hasValidSeasons(params_ref)) return false;
        var epCount = 0;
        for (var i = 0; i < pairs.length; i++) {
            if (isEpisodeElement(pairs[i].element)) {
                epCount++;
            }
        }
        return epCount >= 2;
    }

    function decideSerial() {
        if (serial_decided) return;
        if (anyEpisodes()) {
            is_serial = true;
            serial_decided = true;
        }
    }

    function decideSerialFallback() {
        if (!serial_decided) {
            serial_decided = true;
            is_serial = false;
        }
    }

    function buildUI() {
        if (built) return true;
        if (!serial_decided) decideSerial();
        if (!is_serial) return true;

        var modal = findModal();
        if (!modal || !modal.length) return false;
        modal_ref = modal;

        // Принудительно превращаем стандартное окно в полноэкранное на уровне DOM
        modal.addClass('nfx-fullscreen-modal');

        var existingUi = modal.find('.nfx-episodes');
        if (existingUi.length) {
            ui = existingUi;
            detail = ui.find('.nfx-detail');
            built = true;
            return true;
        }

        var filesBox = findFilesBox(modal);
        if (!filesBox.length) return false;

        filesBox.hide();

        ui = $('<div class="nfx-episodes">' +
            '<div class="nfx-episodes__strip-wrap"><div class="nfx-episodes__strip"></div></div>' +
            '<div class="nfx-detail">' +
                '<div class="nfx-detail__img"></div>' +
                '<div class="nfx-detail__body">' +
                    '<div class="nfx-detail__title"></div>' +
                    '<div class="nfx-detail__meta"></div>' +
                    '<div class="nfx-detail__overview"></div>' +
                '</div>' +
            '</div>' +
        '</div>');

        var strip = ui.find('.nfx-episodes__strip');
        var stripWrap = ui.find('.nfx-episodes__strip-wrap')[0];
        var lastSeason = null;

        pairs.forEach(function (pair, index) {
            var el = pair.element;
            var seasonKey = isEpisodeElement(el) ? ('s' + el.season) : 'other';
            
            if (seasonKey !== lastSeason) {
                lastSeason = seasonKey;
                strip.append('<div class="nfx-season">' + esc(seasonLabel(el)) + '</div>');
            }

            var card = cardHtml(pair);
            card.data('nfx-index', index);

            card.on('hover:focus', function () {
                updateDetail(pair);
                if (stripWrap && card[0]) {
                    var cardLeft = card[0].offsetLeft;
                    var cardWidth = card[0].offsetWidth;
                    var wrapWidth = stripWrap.clientWidth;
                    stripWrap.scrollLeft = cardLeft - (wrapWidth / 2) + (cardWidth / 2);
                }
                try { if (pair.item) pair.item.trigger('hover:focus'); } catch (e) {}
            });

            card.on('hover:enter', function () { if (pair.item) pair.item.trigger('hover:enter'); });
            card.on('hover:long',  function () { if (pair.item) pair.item.trigger('hover:long');  });
            card.on('hover:back',  function () {});

            strip.append(card);
        });

        filesBox.after(ui);
        detail = ui.find('.nfx-detail');

        var firstCard = strip.find('.selector').first()[0];
        try {
            if (window.Lampa && Lampa.Controller && Lampa.Controller.collectionSet) {
                Lampa.Controller.collectionSet(modal);
                if (firstCard && Lampa.Controller.collectionFocus) {
                    Lampa.Controller.collectionFocus(firstCard, modal);
                }
            }
        } catch (e) {}

        strip.on('click', '.nfx-card', function () {
            $(this).trigger('hover:enter');
        }).on('mouseenter', '.nfx-card', function () {
            $(this).siblings('.nfx-card').removeClass('focus');
            $(this).addClass('focus').trigger('hover:focus');
        });

        if (pairs.length) updateDetail(pairs[0]);
        built = true;
        watchModalRemoval(modal);
        return true;
    }

    function scheduleBuild(tries) {
        if (retry_timer) clearTimeout(retry_timer);
        if (tries <= 0) return;
        retry_timer = setTimeout(function () {
            retry_timer = null;
            if (!built) {
                if (!buildUI()) scheduleBuild(tries - 1);
            }
        }, 60);
    }

    function watchModalRemoval(modal) {
        if (!modal || !modal.length) return;
        if (modal_observer) { try { modal_observer.disconnect(); } catch (e) {} modal_observer = null; }
        if (typeof MutationObserver === 'undefined') return;
        try {
            var target = document.body;
            modal_observer = new MutationObserver(function () {
                if (!modal_ref || !modal_ref.length || !modal_ref.closest('body').length) {
                    teardown();
                }
            });
            modal_observer.observe(target, { childList: true, subtree: true });
        } catch (e) {}
    }

    function resetForOpen(e) {
        if (ui) { try { ui.remove(); } catch (err) {} ui = null; }
        if (modal_ref && modal_ref.length) {
            try { modal_ref.find('.torrent-files').show(); modal_ref.removeClass('nfx-fullscreen-modal'); } catch (err) {}
        }
        pairs = [];
        params_ref = (e && e.params) ? e.params : null;
        detail = null;
        built = false;
        serial_decided = false;
        is_serial = false;
        active = true;
        modal_ref = $('.modal:visible').last();
        if (!modal_ref.length) modal_ref = null;
        if (retry_timer) { clearTimeout(retry_timer); retry_timer = null; }
        if (fallback_timer) { clearTimeout(fallback_timer); fallback_timer = null; }
    }

    function teardown() {
        pairs = [];
        params_ref = null;
        detail = null;
        if (ui) { try { ui.remove(); } catch (e) {} ui = null; }
        if (retry_timer) { clearTimeout(retry_timer); retry_timer = null; }
        if (fallback_timer) { clearTimeout(fallback_timer); fallback_timer = null; }
        if (modal_observer) { try { modal_observer.disconnect(); } catch (e) {} modal_observer = null; }
        if (modal_ref && modal_ref.length) {
            try { modal_ref.find('.torrent-files').show(); modal_ref.removeClass('nfx-fullscreen-modal'); } catch (e) {}
        }
        modal_ref = null;
        active = false;
        built = false;
        serial_decided = false;
        is_serial = false;
    }

    function start() {
        try {
            if ($('#nfx-episodes-css').length === 0) {
                $('head').append('<style id="nfx-episodes-css">' + CSS + '</style>');
            }

            if (window.Lampa && Lampa.Listener) {
                Lampa.Listener.follow('torrent_file', function (e) {
                    if (!e || !e.type) return;

                    if (e.type === 'list_open') {
                        resetForOpen(e);
                        if (e.params) params_ref = e.params;
                        if (fallback_timer) clearTimeout(fallback_timer);
                        fallback_timer = setTimeout(function () {
                            fallback_timer = null;
                            decideSerialFallback();
                        }, 1500);
                    }

                    if (e.type === 'render' && active && e.element && e.item) {
                        pairs.push({ element: e.element, item: e.item });
                        if (e.params) params_ref = e.params;
                        if (!serial_decided) decideSerial();
                        if (is_serial && !built) scheduleBuild(60);
                    }

                    if (e.type === 'list_close') {
                        teardown();
                    }
                });
            }
        } catch (err) {
            console.error('Netflix Episodes plugin initialization error:', err);
        }
    }

    if (window.Lampa && Lampa.Listener) start();
    else {
        var wait = setInterval(function () {
            if (window.Lampa && Lampa.Listener) {
                clearInterval(wait);
                start();
            }
        }, 200);
    }
})();