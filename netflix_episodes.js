(function () {
    'use strict';

    if (window.nfx_episodes_plugin) return;
    window.nfx_episodes_plugin = true;

    var PLUGIN_NAME = 'Netflix Episodes';

    /* ------------------------------ styles ------------------------------ */

    var CSS = `
.nfx-episodes{
    padding: 0 1.2em 1.5em;
}
.nfx-episodes__strip-wrap{
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    margin: 0 -1.2em;
    padding: 0.8em 1.2em 0.4em;
}
.nfx-episodes__strip-wrap::-webkit-scrollbar{ display: none; }
.nfx-episodes__strip{
    display: flex;
    gap: 0.9em;
    align-items: stretch;
}
.nfx-season{
    flex: 0 0 auto;
    align-self: center;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: .85em;
    letter-spacing: .18em;
    text-transform: uppercase;
    opacity: .45;
    padding: .4em 0;
    user-select: none;
}
.nfx-card{
    flex: 0 0 auto;
    width: 11.5em;
    padding: 1.1em 1em 1em;
    border-radius: 0.5em;
    background: rgba(255,255,255,0.06);
    border: 2px solid transparent;
    cursor: pointer;
    transition: background .15s, transform .15s, border-color .15s;
    box-sizing: border-box;
}
.nfx-card.focus{
    background: rgba(255,255,255,0.16);
    border-color: #fff;
    transform: scale(1.05);
}
.nfx-card__num{
    font-size: 2em;
    font-weight: 700;
    line-height: 1;
    opacity: .85;
    margin-bottom: .35em;
}
.nfx-card__name{
    font-size: 1.05em;
    font-weight: 400;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 2.6em;
    opacity: .8;
}
.nfx-card.focus .nfx-card__name{ opacity: 1; }
.nfx-card--watched{ opacity: .55; }
.nfx-card--file .nfx-card__num{
    font-size: 1.2em;
    font-weight: 500;
}

.nfx-detail{
    display: flex;
    gap: 1.6em;
    margin-top: 1.4em;
    align-items: flex-start;
}
.nfx-detail__img{
    flex: 0 0 auto;
    width: 22em;
    max-width: 38vw;
    aspect-ratio: 16/9;
    border-radius: 0.5em;
    overflow: hidden;
    background: #1a1a1a;
    position: relative;
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
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3em;
    font-weight: 700;
    color: rgba(255,255,255,0.25);
    background: linear-gradient(135deg,#20242b,#14161a);
}
.nfx-detail__body{ min-width: 0; flex: 1; }
.nfx-detail__title{
    font-size: 1.7em;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: .35em;
}
.nfx-detail__meta{
    font-size: 1.05em;
    font-weight: 300;
    opacity: .75;
    margin-bottom: .8em;
}
.nfx-detail__meta span + span::before{
    content: ' • ';
    opacity: .6;
}
.nfx-detail__meta .nfx-detail__size{
    background: rgba(255,255,255,0.12);
    border-radius: .3em;
    padding: .1em .45em;
}
.nfx-detail__overview{
    font-size: 1.15em;
    font-weight: 300;
    line-height: 1.5;
    opacity: .9;
    max-width: 60em;
}
.nfx-detail__overview--empty{ opacity: .45; font-style: italic; }

body.platform--browser .nfx-detail__img{ max-width: 30em; }

@media screen and (max-width: 767px){
    .nfx-episodes{ padding: 0 .8em 1em; }
    .nfx-card{ width: 9em; padding: .9em .8em .8em; }
    .nfx-card__num{ font-size: 1.6em; }
    .nfx-detail{ flex-direction: column; gap: 1em; }
    .nfx-detail__img{ width: 100%; max-width: 100%; }
    .nfx-detail__title{ font-size: 1.35em; }
    .nfx-detail__overview{ font-size: 1em; }
}
`;

    /* ------------------------------ state ------------------------------- */

    var pairs = [];          // [{element, item}] collected from 'render' events
    var ui = null;           // our root jQuery node
    var detail = null;       // detail panel node
    var active = false;      // a files list is currently open
    var built = false;       // our UI has been inserted
    var serial_decided = false; // we already decided this list is/isn't serials
    var is_serial = false;
    var retry_timer = null;
    var fallback_timer = null;
    var params_ref = null;
    var modal_ref = null;
    var modal_observer = null;

    /* ------------------------------ helpers ----------------------------- */

    function esc(s) {
        return $('<div>').text(s == null ? '' : s).html();
    }

    function isEpisodeElement(el) {
        return !!(el && el.season != null && el.episode != null && el.episode !== '');
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
            if (list[i].episode_number == element.episode) return list[i];
        }
        return null;
    }

    /* ------------------------------ UI bits ----------------------------- */

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

        var img = el.img
            || (meta && meta.still_path && Lampa.Api && Lampa.Api.img
                ? Lampa.Api.img(meta.still_path)
                : '');

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

    /* ------------------------------ modal find -------------------------- */

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

    /* ------------------------------ build UI ---------------------------- */

    function anyEpisodes() {
        for (var i = 0; i < pairs.length; i++) {
            if (isEpisodeElement(pairs[i].element)) return true;
        }
        return false;
    }

    function decideSerial() {
        // is_serial=true only when we actually saw an episode element.
        // For non-serial file lists (movies, single files) we keep the original UI.
        if (serial_decided) return;
        if (anyEpisodes()) {
            is_serial = true;
            serial_decided = true;
        }
        // If nothing episode-like yet, we stay undecided: render events that
        // may still arrive, or list_open's raw items may hint otherwise.
    }

    function decideSerialFallback() {
        // Called when we never saw an episode element. Treat as not serial.
        if (!serial_decided) {
            serial_decided = true;
            is_serial = false;
        }
    }

    function buildUI() {
        if (built) return true;
        if (!serial_decided) decideSerial();
        if (!is_serial) return true;   // leave original list untouched

        var modal = findModal();
        if (!modal || !modal.length) return false;
        modal_ref = modal;

        if (modal.find('.nfx-episodes').length) { built = true; return true; }

        var filesBox = findFilesBox(modal);
        if (!filesBox.length) return false;

        filesBox.hide(); // keep DOM alive: original handlers / lazy images

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
                try {
                    card[0].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
                } catch (e) {
                    if (stripWrap) stripWrap.scrollLeft = card[0].offsetLeft - stripWrap.clientWidth / 2;
                }
                // keep original item's lazy-load/focus behaviour alive
                try { pair.item.trigger('hover:focus'); } catch (e) {}
            });

            // Delegate the actual playback/menu actions back to the ORIGINAL
            // item that Lampa's torrent.js created — keeps Player.play(),
            // playlist building and hover:long menu untouched.
            card.on('hover:enter', function () { pair.item.trigger('hover:enter'); });
            card.on('hover:long',  function () { pair.item.trigger('hover:long');  });
            card.on('hover:back',  function () { /* noop — Lampa handles modal back */ });

            strip.append(card);
        });

        filesBox.after(ui);
        detail = ui.find('.nfx-detail');

        // Pick the first card as the initial focus target
        var firstCard = strip.find('.selector').first()[0];
        try {
            if (Lampa.Controller && Lampa.Controller.collectionSet) {
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

    /* --------------------------- lifecycle ------------------------------ */

    function watchModalRemoval(modal) {
        // If the modal node is detached by any path that doesn't send
        // 'list_close', we still want our state reset so the next open is clean.
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
        // New list — full reset
        if (ui) { try { ui.remove(); } catch (err) {} ui = null; }
        if (modal_ref && modal_ref.length) {
            try { modal_ref.find('.torrent-files').show(); } catch (err) {}
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
            try { modal_ref.find('.torrent-files').show(); } catch (e) {}
        }
        modal_ref = null;
        active = false;
        built = false;
        serial_decided = false;
        is_serial = false;
    }

    /* ------------------------------ listener ---------------------------- */

    function start() {
        if ($('#nfx-episodes-css').length === 0) {
            $('head').append('<style id="nfx-episodes-css">' + CSS + '</style>');
        }

        Lampa.Listener.follow('torrent_file', function (e) {
            if (!e || !e.type) return;

            if (e.type === 'list_open') {
                resetForOpen(e);
                // list_open's `items` are raw file objects (not DOM) — we rely
                // on 'render' events for the actual jQuery items.
                // Fallback: if no episode element arrives soon after open,
                // mark this as a non-serial list so we never shadow a movie.
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
