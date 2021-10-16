# 用Deno脚本加速MediaWiki导入

我们架设了一个Wiki网站，用维基百科一样的MediaWiki软件。MediaWiki提供多种方式导入其他wiki上的页面。其中一种是供网站开发者用的，使用维护脚本importDump.php在控制台导入XML dump。而还有一种，是在网站上使用`Special:Import`导入页面来导入。前者问题比较小，但是需要更高的权限，使用SSH连接命令行执行；而后者只要有跨wiki的导入权限，一般用户也可以执行。

我们以为这两种方式本质是一样的。但实际运行起来，我们的测试系统却频频出现宕机、报错（数据库执行超时）等问题。当然我们服务出问题也可能是多种原因，因此我们也努力改善周边的设施，但导入失败的事情依然困扰着我们的用户。

如果不解决这一点的话，可能未来也有其他隐患。我算是从另一个角度切入这个问题。我判断这个问题的一部分原因是`Special:Import`这个导入方式只设计了成功和失败两个结果。因为如此，所以这个过程开启了一个大大的TRANSACTION（事务），在我们的小机器上，可能就造成了超时或者长时间的数据库锁吧。

如果是这样的话，是否把导入过程拆分就能解决了呢？带着这样的想法，我尝试把原始的XML文件按照page进行切分，把每一份都进行上传，即便有一些不成功，也至少不会有太长的锁吧。有了这个想法，我就开始找，有没有现成的上传API呢？果然MediaWIki提供了，就是[API:Import](https://www.mediawiki.org/wiki/API:Import)。但为了成功调用import，我们还需要做前面的获取登录token、登录、获取csrf token这一整套流程。但由于官网上有node版本以及python版本的实现了，所以这不算太难。

唯一有点考验的应该就是deno的fetch请求默认不支持存储cookie吧。在官方的示例里，我们看到无论是Python也好，Node.js也好，都会先声明一下存放cookie的地方。看起来也许不起眼，但它们都做了这件事

Python版：

```python
S = requests.Session()
```

Node.js版

```js
request = require('request').defaults({jar: true})
```

存放cookie的地方在业界有一个好听的名字，cookie jar，也就是“饼干罐”的意思。其实Deno的第三方库里也有这样的存在，就是[another_cookiejar](https://deno.land/x/another_cookiejar)。而且它起名another的意图是为了不占据cookiejar这个名字。不过我想要展示给大家更加朴素的储存cookie的方式，就是自己去解析服务器返回的Header里面的`Set-Cookie`，并且把它存储起来。事实上我曾经用Lua编写维基机器人的时候，也是用的手工解析cookie的方式。

拿最简单的获取登录token来当例子好了

```js
export async function getLoginToken() {
  const url = new URL(apiUrl);
  url.search = new URLSearchParams({
    action: 'query',
    meta: 'tokens',
    type: 'login',
    format: 'json'
  }).toString();
  const res = await fetch(url);
  cacheCookies(res.headers.get('set-cookie'))
  const data = await res.json();
  return data.query.tokens.logintoken;
}
```

因为是给Deno写代码，我们尽量用比较推荐的方式。虽然我们日常都用拼接字符串的方式解决GET请求的参数，但这里我使用更加标准的方式，建立URL对象，并且用URLSearchParams对象来建立它的参数串。这样的方式就有我们在jQuery里面直接传入对象的感觉了。用fetch的方式拿到请求的结果，之后从它的header里面取出来`set-cookie`解析后存储起来，就可以继续获取body的JSON信息然后拿到token了。

那么cacheCookies里面是什么呢？下面就给大家看一下

```js
import setCookie from './set-cookie-parser.js';

function cacheCookies(combinedCookieHeader) {
  let splitCookieHeaders = setCookie.splitCookiesString(combinedCookieHeader)
  let cookies = setCookie.parse(splitCookieHeaders, { decodeValues: false });
  headers.set('Cookie', cookies.map(x => `${x.name}=${x.value}`).join('; '));
}
```

这边我用到了一个外部库，叫做set-cookie-parser。这个库是在node领域的一个很流行的库，用来解析`Set-Cookie`的内容。不是我实现不了，只是不想再费劲自己去写一个了。但是需要注意，我们用Deno拿到的`Set-Cookie`是用逗号连接起来的，多个`Set-Cookie`拼接起来的。所以需要先split一下才能调用parse。但这个split并不是简单朴素的split，所以如果自己实现需要注意，因为单个cookie里面，Expires日期字段，也是有逗号的，如果不注意，就会把单个cookie从内部分开了。

就这样，以同样的方式，我们就能实现`getLoginToken`、`loginRequest`、`getCsrfToken`和`importXML`四个函数了。官方的Node.js实现采用了一环套一环的传统异步程序编写方式，但我们在Deno里，当然要用async...await了，不能被时代落下。

介绍完核心部分，这篇文章就结束了吗？不是的，我认为主要流程方面也需要介绍一下。XML的拆分page就是简单的字符串匹配，没什么好讲的。我想要讲的就是主循环部分。

```js
while (xmlPool.length > 0) {
  console.log('POOL LENGTH: ' + xmlPool.length);
  // get csrf token
  try {
    await mwapi.getCsrfToken();
  } catch (e) {
    continue;
  }

  const controller = new AbortController();

  await Promise.all(xmlPool.map(x => mwapi.importXML(
    `${mwStart}${siteInfo}${x}${mwEnd}`, controller.signal
  ))).then(values => {
    for (const i in values) {
      if (values[i].error) {
        if (values[i].error.code === 'badtoken') {
          controller.abort();
        }
        failedXML.push(xmlPool[i]);
      }
    }
  });
  
  if (xmlPool.length === failedXML.length) break;
  xmlPool = failedXML;
  failedXML = [];
}

if (failedXML.length) {
  Deno.writeTextFile('failed.xml', `${mwStart}${siteInfo}${failedXML.join('')}${mwEnd}`);
  console.error('Last run didn\'t consume any input, import unsuccessful. Failed pages can be re-imported with failed.xml.');
}
```

我在主循环部分也玩了玩花样。虽然这看起来是再平常不过的主循环。我认为这里面主要特别的地方就是错误处理。按我的理解，有些异常处理就是要在主循环里做的，如果放在封装的API里就处理掉了，那我们在主循环里就不能做我们想做的事了。

先提一下，我之前处理好的XML片段我都存到了`xmlPool`这个数组里面，这里就直接用了。由于我们各个条目之间没有谁先谁后的关系，所以为了发挥好异步的优势，我直接就用了`Promise.all`这个语法。它是能够代替你管理这些Promise的一个语法，而且你能知道什么时候所有这些请求都执行完了。`Promise.all`这个函数本身返回的也是一个`Promise`，所以为了后面的代码能够在这后面执行，我直接就在前面加了await，意思是“后面的等一等”。

在主循环里我用了一个没用过的功能，一个在MDN上标注是Experimental的功能，那就是`AbortController`。我把它用在了CSRF token失效的情景。因为我发现普通账号在上传50次左右的时候，系统就会让你的CSRF token过期。如果过期了，那么还在跑的其他fetch请求不就没用了嘛。我不想让它们继续浪费时间，我想要在我收到`badtoken`错误的时候，立刻把其他的fetch都停掉。而这项功能，目前也就用`AbortController`可以优雅地实现。`AbortController`会有一个signal，在你发出abort命令的时候，那些仍然没有resolve的fetch将会立即停掉。

还有就是，我在检测到某一次循环一个XML片段都没有用掉的时候，我就会跳出循环了。因为可能遇到什么外部故障了。此时跳出循环，我可以把剩余的没有传成功的XML还按MediaWiki dump的格式组织起来，以便网络条件好的时候再次传输。

---

以上就是我制作的加速MediaWiki导入的Deno脚本的核心内容啦。要说明一下，我最初写的时候，主循环没有这么麻烦的。因为我首要的任务是确定这么做确实能够在我们的环境顺利导入，而且不会把服务或数据库搞出问题。但是有了几位朋友用过之后，就遇到了一些不稳定的问题，这才让我再次将异常处理做得更好，让它成为一个较为稳定的工具。[∎](../ "返回首页")
