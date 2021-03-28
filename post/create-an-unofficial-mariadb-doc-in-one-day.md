# 我如何用一天时间搭建非官方的MariaDB文档

当然你可能说，搭建一个非官方的文档网站完全不需要一天时间，只要反向代理一下就完成了。但我想说的不是这样。我做这个非官方文档主要有三个原因：

- 原来的文档是以Wiki形式储存，无法更好地展现这份文档的结构
- 我要把原始的文档转为Markdown格式，更容易转换成PDF或者其他格式随身携带，也能够自动使用Markdown格式文档的众多工具
- 我还有一个私心就是我有把这个文档翻译成中文的想法，我需要了解一下到底有多个文档需要翻译

在业务时间方面，我并不是很充足，但其实我自己也没想到这件事情一天就做了差不多。我本来的预估是干上几个周末。

## 预备工作

做这件事情之前，我先做的就是在搜索引擎上搜索mariadb doc portable以及mariadb doc pdf，还有mariadb doc offline等关键词，寻找有用信息，另外就是确认之前没有人已经做过这个工作了。因为不重复造轮子的观念，如果有人已经做过了，我就要考虑是否不去做这件事情。但事实我没发现有人做过，其实对于这个结果我也很诧异。MariaDB作为多个操作系统预装的MySQL分支，用户也不乏大公司，但就因为官方没有出过可以下载的文档版本，就没有人自行制作。

我妄自猜测一下，有可能是这几个原因造成没有可下载版的MariaDB文档：

- MariaDB公司靠MariaDB数据库技术支持以及MariaDB的周边吃饭，如果人们太方便了，那他们还哪来业务呢
- MySQL的各种文档很多。可下载的也有，中文的或者翻译成中文的也有；人们使用MariaDB的一个重要原因是它作为MySQL的一个drop-in replacement。包括我自己以前，几乎都是直接去查MySQL的官方文档，用它来当MariaDB的参考
- 在线的参考将就能用，如果没有必要，谁会去再整一份呢

但我还是看到确实有人有离线版的需要，就像我一样。说实话，有时候文档这种东西，光是在线能够浏览，就是我这种人吧，总觉得不够，“不能一览全貌”。一个一个链接，到底有多少层，谁知道呢？就感觉望不到头。

好在这个knowledge base（kb）里[告诉了我们](https://mariadb.com/kb/en/meta/mirroring-the-mariadb-knowledge-base/)，如何做一个kb的镜像网站。那就是通过Linux最常用的下载工具之一wget。官方告诉我们的命令是这样的：

```bash
wget \
  -e robots=off \
  --recursive --no-clobber --page-requisites \
  --adjust-extension --convert-links \
  --restrict-file-names=windows \
  --domains=kb-mirror.mariadb.com \
  http://kb-mirror.mariadb.com
```

我一开始也是用的跟上面一模一样的命令。但我后面改成了下面这个命令：

```bash
wget \
  -e robots=off \
  --recursive --no-clobber --page-requisites \
  --adjust-extension  --domains=kb-mirror.mariadb.com \
  --restrict-file-names=nocontrol \
  --include-directories=kb/en/library/documentation \
  http://kb-mirror.mariadb.com/kb/en/library/documentation/
```

为什么改呢？因为我发现上面那个命令我要下载的东西太多了，有很多超出了MariaDB文档的范畴。我下面这个命令会以http://kb-mirror.mariadb.com/kb/en/library/documentation/ 这个页面为起点，而且如果页面跳转出了kb/en/library/documentation的反馈，wget的递归就不会追踪下去。另外就是，下面少了`--convert-links`这个命令。在用上面那个命令的时候，我发现no-clobber（也就是已经存在的不重复下载）这个选项设置了不起作用，上网查了才知道，convert-links这个选项始于no-clobber冲突的。另外，为了我后面追踪文件名称方便，我也不需要wget帮我自动转换链接，我要自己处理。

## HTML到Markdown的转换

上面我们已经下载好了HTML格式的文档，那么如何把它转换成Markdown呢？我跟大家一样，首先考虑的是用现成的工具。但是我试了一遍以后发现，没有一个工具是能够完美转换的，那还不如自己写一个。自己写的话，可以写得简单一些，不用把所有的转换都实现，因为Markdown支持HTML block，也就是我们保留原始HTML，也不用太担心违反Markdown的标准。

你或许在想，那干脆不要转换了，直接把HTML放那呗。我们把HTML转为Markdown还有一个重要原因是，生成容易维护的文档。为什么大家都喜欢用Markdown写文档，而不直接写HTML呢？HTML也不难，但Markdown更简洁，没有多余的tag，Markdown是一个源码都对人类友好的语言，而HTML以至XML是源码对机器更友好的语言。

在编写HTML到Markdown转换的选择上，我首选了Deno，用JS语言写。为什么我没用最爱的Lua呢？其实我也尝试了，但发现Lua的没有像JS一样的全面而好用的DOM。为了避免不懂前端的同学不知道DOM是什么，我来解释一下。我们看一下维基百科

> 文档对象模型（DOM）是一个跨平台和独立于语言的接口，它将XML或HTML文档视为一个树形结构，其中每个节点是一个对象，代表文档的一部分。

DOM是操作HTML的一个非常方便的方式，它其实是语言无关的，任何语言都可以按照DOM标准实现一个这样的操作库。

![dom](https://upload.wikimedia.org/wikipedia/commons/5/5a/DOM-model.svg)

但是最常说的DOM还是Web浏览器中的DOM，允许JS操作HTML文档。JS中实现的DOM也一般来说是最接近标准的，函数最全的。所以为了节约时间，我们就直接用JS吧。

```js
import { DOMParser, Element } from "./deno-dom/deno-dom-wasm.ts";

const text = await Deno.readTextFile(‘/path/to/source’);
const doc = new DOMParser().parseFromString(text, "text/html");
```

在Deno里我们用deno-dom这个DOM实现。如果你更习惯Node.js，也有很多可以用在Node.js里的DOM实现。通过解析HTML获取到我们的doc，相当于浏览器中的全局document变量。

有了DOM，HTML文件对于我们来说不再是文本结构，而是一个树结构。于是我们可以用最简单的递归来一层层遍历这棵树。于是我实现了这样一个JS函数，

```js
function traverseNode(node) {
  for (const child of node.children) {
    const nodeName = child.nodeName;
    const hTag = nodeName && nodeName.match(/^H(\d)$/);
    if (nodeName === 'P' || hTag) {
      segments.push({ tag: nodeName, data: child.innerHTML.trim() });
    } else if (nodeName === 'TABLE') {
      segments.push({ tag: nodeName, data: child.outerHTML });
    } else if (nodeName === 'PRE') {
      segments.push({ tag: nodeName, data: child.textContent });
    } else if (nodeName === 'HR') {
      segments.push({ tag: nodeName, data: '---' });
    } else if (nodeName === 'UL' || nodeName === 'OL') {
      const list = [];
      for (const item of child.children) {
        list.push(item.innerHTML.trim());
      }
      segments.push({ tag: nodeName, data: list });
    } else if (nodeName === 'DIV') {
      traverseNode(child);
    } else {
      console.log(child.nodeValue ? child.nodeValue.trim().substring(0, 50) : nodeName);
    }
  }
}
```

这个函数很好懂，就是针对你遇到的节点它的nodeName，来做不同的处理而已，简简单单的if...else，想理解不了都难吧。比如，遇到DIV之后，就再往里遍历一层；遇到P段落，就把它里面的HTML去掉两边的空格，等待后面的处理。我们要把我们的思维变成一步一步，而不是想着一步就搞定所有事情。

经过遍历的DOM，就留下了对我们有用的segments，于是我们就可以再对segments做进一步处理

```js
function processSegments() {
  let prevTag = null;
  for (const item of segments) {
    let tag = item.tag;
    const hLevel = tag.match(/^H(\d)$/) && RegExp.$1;
    if (hLevel) {
      item.data = '#'.repeat(hLevel) + ' ' + basicMarkdown(item.data);
    } else if (tag === 'PRE') {
      item.data = '```sql\n' + item.data.replace(/\n$/g, '') + '\n```';
    } else if (tag === 'P') {
      item.data = basicMarkdown(item.data);
    } else if (tag === 'UL') {
      item.data = item.data.map(x => '- ' + basicMarkdown(x))
        .join('\n');
    } else if (tag === 'OL') {
      item.data = item.data.map((x, index) => (index+1) + ' ' + basicMarkdown(x))
        .join('\n');
    }
  }
}
```

在这一步里，我们把我们准备好的segments再放进锅里，不就顺理成章了？等等，我不是在教做菜。不过差不多啦。用processSegments这个锅炒炒，就能炒出我们的markdown了。是不是过于简单了。

其实我把上述的整个流程都扔到了toMarkdown这么一个函数里。因为读取文件这个过程在Deno中是一个异步过程，所以toMarkdown是一个async函数。然后我们还要准备一个遍历文件夹的函数，我用的都是Deno原生的方式，没有依赖任何库，甚至Deno标准库都没依赖。

```js
async function visitDir(currentPath) {
  let names = [];
  
  for await (const dirEntry of Deno.readDir(currentPath)) {
    const entryPath = `${currentPath}/${dirEntry.name}`;
  
    if (dirEntry.isDirectory) {
      await visitDir(entryPath);
    } else {
      Deno.writeTextFile(entryPath.replace(/^documentation/,'maria-doc').replace('index.html', 'README.md'),
        await toMarkdown(entryPath));
      //await toMarkdown(entryPath)
    }
  }
}
```

你或许发现，我们不知不觉用上了for await ... of的语法，在Deno里面，你会爱上JavaScript最新的标准的，你不会再考虑用什么axios发请求，全部都会是fetch，因为Deno不给你机会用XMLHTTPRequest；你还会非常习惯地使用Promise，而且是用async ... await关键词，因为太方便了。Deno是我理想地编写JS脚本的方式。

## 解决wget把文件路径过长的文件强行重命名的问题

由于MariaDB的文档层级过多，路径名起得还挺长，于是就有了超过操作系统限制。wget没有等到操作系统提示我们，直接就自己做主把路径变掉了。

```
The name is too long, 258 chars total.
Trying to shorten...
```

大概就是这样一个提示，这就造成了部分文件名与其他的不一样。正常的都应该是叫index.html的，有的被截得只剩i.html，还有的甚至截到了上级目录。于是我们拿Deno脚本遍历修复一下，修改一下我们之前的visitDir函数就搞出来这个了

```js
async function visitDir(currentPath) {
  for await (const dirEntry of Deno.readDir(currentPath)) {
    const entryPath = `${currentPath}/${dirEntry.name}`;
  
    if (dirEntry.isDirectory) {
      await visitDir(entryPath);
    } else {
      if (dirEntry.name != 'index.html') {
        let rawName = dirEntry.name.replace(/[.].*/, '');
        if ('index'.startsWith(rawName)) {
          Deno.rename(entryPath, `${currentPath}/index.html`)
        } else {
          const text = await Deno.readTextFile(entryPath);
          const fname = text.match(/\<a[^>]*?class="node_link[^>]*?href=".*?\/([^\/]*?)\/"/)
                  && RegExp.$1;
          if (fname) {
            const newPath = `${currentPath}/${fname}`
            await Deno.mkdir(newPath)
            Deno.rename(entryPath, `${newPath}/index.html`)
          }
        }
      }
    }
  }
}
```

同样的脚本我们再改一下，帮我们创建一波文件夹，因为我要把markdown输出到maria-doc这个文件夹下（我把原来的文档下载于documentation这个文件夹），对于没有父文件夹的，会导致文件创建错误。

```js
async function visitDir(currentPath) {
  for await (const dirEntry of Deno.readDir(currentPath)) {
    const entryPath = `${currentPath}/${dirEntry.name}`;
  
    if (dirEntry.isDirectory) {
      Deno.mkdir(entryPath.replace(/^documentation/,'maria-doc'), {recursive: true})
      await visitDir(entryPath);
    }
  }
}
```

好了，在这样的处理下，我发布了第一版Markdown文档到GitHub上。但是随便点点，我发现连JOIN Syntax这篇文档都没有，我意识到wget并不只是改名而已，有一部分文档是真的没下下来。于是我开始考虑怎么把这些丢失的文档下载下来。于是我在原来把HTML转换Markdown的代码里加入了把不存在的链接输出出来的代码，这里不赘述。如果正经做的话，应该单独写一个脚本来处理的，但我没有时间，所以只能让电脑多费点时间了。

在我拿到一个链接列表以后，就可以通过下面这个脚本下来写入了

```js
const missing = [
'/kb/en/library/documentation/xxx/',
'/kb/en/library/documentation/xxx/',
'/kb/en/library/documentation/xxx/',
'/kb/en/library/documentation/xxx/',
];

Promise.all(missing.map(x => fetch('http://kb-mirror.mariadb.com' + x).then(res => res.text())
  .then(async data => {
    try {
      const folder = x.substring(15)
      await Deno.mkdir(folder, {recursive: true});
      Deno.writeTextFile(folder + 'index.html', data);
    } catch (e) {
      console.log(e)
    }
  })));
```

这个Promise.all是我编写异步请求标准的写法。我不知道是不是有其他优雅的写法，我能想到的就是把它都包在Promise里面，然后让Promise.all来帮我全部调用。

用这些操作，我成功地补充了一部分之前没下载下来地文档。可以说，已经可以算作一个相对完整地文档了。下面就是把它做成一个文档网站了。

## 用docsify把大批Markdown做成一个文档网站

虽然只有Markdown在GitHub上已经足够浏览以及下载了，但是我想再进一步，做成一个文档网站，放到我的GitHub Pages上，供大家浏览。

我首先想到的是GitBook，但是我最近访问GitBook的时候遇到了些问题，GitBook似乎有一些限制，不像以前那么自由。于是我转向VuePress，但是它让我失望了，webpack编译让我的内存直接溢出。我果断放弃VuePress，开始继续搜索。终于，我我选中了另一个工具，docsify，但我也不知道它怎么样，就抱着试一试的态度开搞。先全局安装CLI工具

```bash
yarn global add docsify-cli
```

然后到我的文档目录

```bash
docsify init ./maria-doc
```

然后瞬间结束了。WHAT？怎么不编译呢？我在文件夹里一个HTML也没看到。继续查了查才知道，原来docsify本身就是不编译直接读取Markdown文档的。我看了看index.html，还真的可以用。于是我高兴地提交了第二版代码到我的GitHub仓库里。

默认的配置就是可以用的，但是后续我加了一些docsify的插件，比如SQL高亮、全文搜索、页面右侧目录、侧栏自由折叠等。配置的话就是下面这样

```js
window.$docsify = {
  name: 'Unofficial MariaDB Server Documentation',
  repo: 'AlexanderMisel/mariadb-documentation',
  auto2top: true,
  loadSidebar: true,
  sidebarDisplayLevel: 0,
  search: 'auto',
  toc: {
    tocMaxLevel: 3,
    target: 'h2, h3'
  },
}
```

然后其实我还自动生成了一下`_sidebar.md`，这个文件是帮助docsify组织目录的，不然它只能看到当前文件的目录。具体过程代码我都会放在我repo的Wiki中，供大家参考。

---

到此，我们的非官方的MariaDB文档就在GitHub Pages搭建完成了。大家可以去下面这个网址看到我这篇博客搭建出来的效果：https://alexandermisel.github.io/mariadb-documentation/

欢迎大家star我这个repo，上面网页的右上角就有GitHub corner，可以点击进入repo。对于Deno、docsify我都是新手，现学现卖，有什么更好的建议，大家可以反馈给我。[∎](../ "返回首页")