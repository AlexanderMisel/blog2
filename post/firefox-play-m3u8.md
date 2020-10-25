# Firefox播放某小网站的m3u8视频

我是一个会在小网站看免费资源的人。许多小网站的视频都使用了m3u8这种格式提供视频流，这个格式是苹果公司搞的。它的协议名称叫做HTTP Live Streaming（简称HLS）。而m3u8文件实际上就是一个播放列表，你播放一个网上的视频的时候，其实浏览器要请求对应片段的地址，并进行解码。HLS是基于HTTP协议的，没有用到其他特殊的协议，于是也减少了被个别防火墙拦的风险。

早年，这些小网站都会采用Flash来解码并播放HLS的视频。在新时代，Flash退出了历史舞台，众多小网站面临转向HTML5播放的路子。当然，很多小网站提前在手机端就进行了试点。[DPlayer](https://dplayer.js.org/zh/)就是一款非常受到这些小网站开发者青睐的一款国产HTML5播放器。DPlayer支持多种视频流格式，而且还有字幕、弹幕、截图等额外功能，连学习强国、小红书都在用呢。

我所看的9rmb这小网站就加载了这个DPlayer以及HTML5和Ckplayer，它调用一个接口，返给前台判断到底应该用哪个库进行播放。然而目前在我的Firefox上，m3u8的视频它让我用HTML5原生video去解析。

这个问题出现有几年了。我都有点想放弃这个网站了。但最近一次搜索，我了解到了点新东西，就是媒体源扩展API（简称MSE）。MSE是在Web上无插件地播放视频和音频的一个重要的功能。它的维基百科是这样介绍的：

> **媒体源扩展**（Media Source Extensions，缩写**MSE**）是一项[W3C](https://zh.wikipedia.org/wiki/万维网联盟)规范，它允许[JavaScript](https://zh.wikipedia.org/wiki/JavaScript)将[比特流](https://zh.wikipedia.org/wiki/位元流)发送至[网页浏览器](https://zh.wikipedia.org/wiki/网页浏览器)中支持[HTML5视频](https://zh.wikipedia.org/w/index.php?title=HTML5视频&action=edit&redlink=1)的[编解码器](https://zh.wikipedia.org/wiki/编解码器)。除上述用途外，它还使客户端可以完全在JavaScript中预取和[缓冲](https://zh.wikipedia.org/wiki/緩衝器)[流媒体](https://zh.wikipedia.org/wiki/流媒体)的代码。

并不是说我完全理解了MSE，我得知上面所说的之后，我就有理由相信用JS处理流媒体是能搞的。而且我顺利地发现，有一个叫做HLS.js的库，被众多扩展用来播放HLS的流。我随后看了DPlayer的依赖，也同样发现了HLS.min.js这个JS。说明它是可以采用MSE这个功能，播放原本浏览器不支持的流类型的。既然有这个，我想，9rmb上的m3u8播放我完全可以通过一小段油猴脚本来修正过来。于是就有了下面的代码。

```js
// ==UserScript==
// @name         Play9rmb
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to play HLS stream!
// @author       Alexander Misel
// @match        https://qq.79da.com/*
// @grant        none
// ==/UserScript==

(function() {
    var theUrl = window.player.toString().match(/'url':'(.*?)'/) && RegExp.$1;

    function player() {
        var form = '0';
        var formios = '0';
        $.post("api.php", {
            'url': theUrl,
            'referer': '',
            'ref': form,
            'time': parseInt(Date.now() / 1000),
            'type': '',
            'other': btoa(other_l),
            'ios': formios,
            'ref': form
        },
        function(data) {
            if (data.code == "200") {
                if (data.hiddenreferer == "true") {
                    var nometa = document.createElement('meta');
                    nometa.name = 'referrer',
                    nometa.content = 'never';
                    document.getElementsByTagName('head')[0].appendChild(nometa);
                }
                if (data.play == "iqiyi") {
                    var url = data['url'] + '&vf=' + cmd5x(data['url']);
                    $.ajax({
                        url: '//cache.m.iqiyi.com' + url,
                        dataType: 'html',
                        async: false,
                        success: function(json) {
                            var j = eval("(" + json.substring(13) + ")");
                            data.url = j.data.m3u;
                            data.player = "dplayer";
                            data.type = "auto";
                        }
                    });
                }
                if (data.player === "h5" || data.player === "dplayer") {
                    const dp = new DPlayer({
                        container: document.getElementById('a1'),
                        theme: '#b7daff',
                        loop: true,
                        autoplay: true,
                        preload: 'auto',
                        theme: '#28FF28',
                        video: {
                            url: data.url,
                            pic: 'https://ae01.alicdn.com/kf/H04b0ae529f2d44b4a246ec1f574ef558e.jpg',
                            type: data.type,
                        },
                        hlsjsConfig: {
                            p2pConfig: {
                                logLevel: true,
                                live: false,
                            }
                        }
                    });
                    dp.seek(sessionStorage.getItem('pay' + data.url));
                    setInterval(function() {
                        sessionStorage.setItem('pay' + data.url, dp.video.currentTime);
                    },
                    1000);
                } else if (data.player == "url") {
                    $('#a1').html('<iframe width="100%" height="100%" frameborder="0" border="0" scrolling="no" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" allowtransparency="true" src="' + data.url + '"></iframe>');
                }
                $("#loading").hide();
                $("#a1").show()
            } else {
                $("#loading").hide();
                $("#a1").hide();
                $("#error").show();
                $("#error").html(data.msg)
            };
        },
        "json")
    }

    player();
})();
```

其实我是把网页原有的player函数给改掉了。在网页中，它的points.js中调用到了player函数，但是我发现points这个JS很占内存，所以就干掉了，直接在我的Tampermonkey里面调用。网站应该是用了php，动态生成player函数里面的URL等参数。我为了省事，只拿了URL这一个参数。方法其实比较取巧，用的`window.player.toString()`去正则匹配。toString会把一个JS函数的源代码String拿出来，还真是方便呢。

它向api.php发起的请求，其实就是告诉前端用哪个播放器去播。我这里把不管h5还是dplayer的，统统用DPlayer去播，就解决了这个问题。这样在Firefox上也可以在网页里看m3u8了。[∎](../ "返回首页")

