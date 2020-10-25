(function() {
    'use strict';
    var GM_addStyle = function (css) {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.id = 'GM_addStyleBy8626';
        style.innerHTML = css;
        document.head.appendChild(style);
    };

    var flag = false;
    var ua = navigator.userAgent;
    if (ua.includes('Windows NT')) {
        var winVer = ua.match(/NT (\d+)/)[1];
        if (winVer > 9) {
            flag = true
        }
    }
    if (flag) {
        GM_addStyle('#write strong { font-weight: bolder }');
    }
})();
