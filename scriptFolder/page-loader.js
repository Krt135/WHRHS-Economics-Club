(function () {
    var SELECTOR = '.skeleton-card, .loading-state';
    var MAX_MS = 15000;

    // offsetParent is null for anything inside a display:none ancestor, so
    // placeholders sitting in a hidden view/tab don't keep the bar running.
    function hasVisiblePlaceholder() {
        var nodes = document.querySelectorAll(SELECTOR);
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].offsetParent !== null) return true;
        }
        return false;
    }

    if (!document.body || !hasVisiblePlaceholder()) return;

    var bar = document.createElement('div');
    bar.className = 'tef-loadbar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Loading page content');
    bar.innerHTML = '<span class="tef-loadbar-fill"></span>';
    document.body.appendChild(bar);

    var observer;
    var timer;
    var scheduled = false;

    function finish() {
        observer.disconnect();
        clearTimeout(timer);
        bar.classList.add('done');
        setTimeout(function () { bar.remove(); }, 400);
    }

    function check() {
        scheduled = false;
        if (!hasVisiblePlaceholder()) finish();
    }

    // Debounced with a timer rather than requestAnimationFrame: rAF doesn't run
    // in a background tab, which would leave the bar stuck until it's refocused.
    observer = new MutationObserver(function () {
        if (scheduled) return;
        scheduled = true;
        setTimeout(check, 50);
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden']
    });

    // Safety net: if data never arrives, stop animating rather than run forever.
    timer = setTimeout(finish, MAX_MS);
})();
