# 用Lua编写维基机器人
很长时间以前我就有用Lua编写维基机器人的想法。但出于懒和对Lua不够了解等因素，一直就没有动手。前一段时间正好得知长期以来一直更新中文维基百科的你知道吗（DYK）栏目的机器人Liangent-bot挂掉了，几个月以来都没有恢复，所以正好我也研究一下Lua怎么开发一个机器人。一直觉得这件事情可行，但是却没有去考虑具体怎么做。

这个机器人也算是我对于机器人的一个入门吧。我是一个搞前端的，JS应该说是一门比较熟的语言了，以前呢，也一直在写一些JS脚本，来改善他人或者是自己的编辑/阅读体验。我也想过是否就用Node.js来写这个机器人，不过看各位大佬都有很成熟的Node.js实现了，我再实现一个简陋的也没什么意义。于是最终打算用Lua这个轻量级语言来实现新的bot。

在有这个想法之后，我就有意识地在GitHub搜索资源了，然而收获不大。我最终是在元维基的机器人页面看到了一个lua的mw库，就是dtMediaWiki。这个库是用在Commons上用来传图的，但API都是一样的。有这个库，对我这个lua小白来说无疑是很有帮助的。

有了这个基础，我也就了解到，在lua下如何进行HTTPS请求，LuaSec无疑是一个经典的库，它与lua网络请求库LuaSocket是一脉相承。说得这么好听，但是折腾起来起初并不顺利。其中第一个难关就是编译这些库。

## Lua库的编译
首先大家知道Lua是一门脚本语言，如果是一个纯lua编写的库，是不需要编译的。你甚至可以直接下载下来源码就运行，比如三个依赖中的multipart-post就是这样的库。虽然我们学机器人并不需要传文件，但我觉得为了保持库的完整性，我不会把上传这个已有的功能去掉。

Lua-json这个库呢，其实并不是一个流行的JSON操作库。在我之前还没有用过Lua的外部库的时候，就已经听说过cjson或者dkjson这些广泛使用的JSON库了。[^Popular] 我一开始没有去找其他这些库的原因图省事。不过后来我换上了一个比cjson还快的库，甚至是“国产”的，就是rapidjson。这里我就不细说JSON解析库了，总之提一句，Lua语言的主流JSON解析库的API都是一样的，这让从一个库迁移到另一个库只需要改下require的包就行了。

最烦的还是LuaSec这个库，说实话其他的库就算编译也不难吧。首先就是抛上一个最简单的解决方案，那就是下载ZeroBrane这个IDE。这可能是最流行的一个Lua的IDE了，至少Google告诉我的结果是这样。虽然我在Lua交流群里听到很多其他结果，比如SciTE、EmmyLua、VSCode等。说实话我本可以不用IDE的（用Textadept开发），但因为ZeroBrane这个IDE它ship了LuaSec 0.6，而且我发现不可以通过简单地把ssl.dll等库文件直接复制到其他常用的Lua发行版[^ZeroBrane]里面。所以索性就用ZeroBrane了。ZeroBrane的作者Paul Kulchenko似乎也是一个“开箱即用”主义者，它的package里面带的包管理器也是基于LuaDist，LuaDist里面的包几乎都是二进制的，不需要你安装MinGW或是MSVC。所以你如果想运行我的Lua代码，装个ZeroBrane就好了。

我确实也就像上面那样，用着现成编译好的库，写完了bot的第一版（具体细节后面会说）。不过我还是想说说Lua库的编译，毕竟LuaDist里面的库太老旧，数量也不够多。我想以LuaSec为例，毕竟这个库属于有外部依赖类型的，也是最不容易编译的一种类型。

### 编译Lua库的准备
- LuaRocks老旧版（也就是legacy Windows package, includes Lua 5.1这个版本）。为什么用这个？因为它带了一堆配置文件和Lua 5.1。
- MinGW（也就是GCC编译器以及GNU工具链的一个Windows版，我选用的是一个叫做TDM-GCC的版本，因为它似乎在Windows上更加易用）
- CMake（似乎是LuaRocks的要求，鼎鼎大名的构建工具，不介绍了）

还有一些具体准备步骤，比如：
- 因为我们是用MinGW编译，所以在安装LuaRocks的时候要注意以下配置
  ```bat
  install /L /MW
  ```
  我这里用`/L`也就是LuaRocks自带的Lua 5.1的原因是，我装的其他Lua没有自带源码，我也不想LuaRocks来管理我的包。
- 不过，不难发现，LuaRocks自带的Lua是用MSVC编译的，而我要在ZeroBrane中使用，不是说用他的库链接不行，而是说，链接完了之后，生成的dll也会依赖MSVC的运行时。而我想要的是真正的no dependencies。我们最好的方法就是拿我们自己的Lua以及Lua5.1.dll和Lua51.dll把刚才自带的那几个文件替掉，把那一堆MSVC运行时也删掉。
- 对于LuaSec这种库，还要准备的是外部依赖（external dependencies）。下面我就针对性地介绍一下LuaSec的外部依赖是怎么被我搞定的。

LuaSec的外部依赖叫做OpenSSL，是一个业界常用的加密通信库。Linux和Mac通常会自带OpenSSL，虽然也许不是最新版，但通常能够使用。Windows则没有自带。有两个选择，一个是直接从源码编译，另一个是找编译好的版本。我明确地说，我采用的是后者，但是也想给采用前者的人一点建议。

如果你是要从源码编译的话，第一步就是从GitHub下载源码，你要从你的MinGW的包管理器里安装msys-perl。然后呢，你还需要进入OpenSSL目录下运行
```bash
./configure mingw shared # 这一步是配置成编译dll的，而且使用MinGW编译
make
```
就会产生我们需要的两个dll文件。OpenSSL的1.0.2之前似乎是libeay32.dll和ssleay32.dll，但如果你编译的最新版的OpenSSL的话，它们的名字似乎是libcrypto-1_1.dll和libssl-1_1.dll。当然我们也可以直接去下载别人build好的版本，但一定要注意他是用MSVC构建的，还是用MinGW，而且也要保留下来源码，以便我们一起使用。我是从 https://bintray.com/vszakats/generic/openssl 下载的，这刚好是用MinGW构建的。

### 开始编译Lua的库
那么下一步，我们就该构建LuaSec了。首先就是下载LuaSec的源码。我一般不会直接`luarocks install`，因为这样会把源码下载到临时文件夹里，构建出错就真的错了。下载源码就不一样，构建出了问题还可以改CMake配置，改源代码，最终构建成功。直接在源码上构建的命令是下面这个：
```bash
luarocks make
```
但是这时候make肯定不通过啊（不过对于没有外部依赖的库，直接这样就行了）。因为需要引入外部依赖。我不太喜欢用命令行参数的方式传进去，我推荐大家另一种方式，把外部依赖放到C:\external目录下，就这么简单。在external下创建两个目录，bin里面放二进制的库，include里面放源码。然后再构建就会发现一切正常。

最终的结果会自动拷贝到你LuaRocks配置的目录下，默认是systree。如果你需要使用，可以拷到咱们的ZeroBrane的目录里使用。这里不详细介绍。

## 编写维基机器人
真的别怪我跑题，如果没有前面构建好的库，后面开发起来也会不顺，或者受到局限。编写维基机器人的第一步应该说并不是写逻辑，而是把MediaWikiApi这个Lua模块搞好。我做的主要维护有：把原来从来不用的`GET`请求用起来了，所有query都走`GET`。然后把协议改成TLS 1.2了，1.2我都嫌不够安全呢，更别说默认配置了。还有就是加了编辑整篇和附加到前面或者后面的函数。

其实编写一个机器人最核心的就是模式匹配，以及对逻辑的理解。DYK机器人由于有一个参考实现，就简单了很多，简单说就是把原来的代码抄一遍。但是由于一些页面已经调整成使用维基模板的实现，这部分机器人代码就可以省去了。

虽然有参考实现，但DYK更新有些逻辑还是需要理解的。由于原机器人作者已经不活跃，我们只能根据自己的理解，结合她的代码，整理成新的代码。

我对Lua的面向对象不够熟悉，而且我觉得也没必要面向对象，所以我的代码都是过程化的。

整体上编写这个机器人的逻辑没有什么难度。要说有点没预料到的就是对日期的处理。DYKC页面的所有日期标题都会在初始处理的时候删去，在一切都处理完之后再按照timestamp去判断哪里需要加入日期标题。所以timestamp很重要啦。

Lua的日期处理其实有成熟的库的，但是我个人不太想因为这点使用就引入更复杂的库。系统支持的`os.date`和`os.time`就挺好。还有其实我还为这个调研了Lua的异步请求的库copas，不过我没有在DYK更新这个脚本里用到，用在了我另一个查维基QQ群成员群名片的脚本里，那个脚本需要大量的请求，异步的话大概能节省一半的时间。

就这样，我实现了机器人的第一个版本。其实我的本意也就是想要把维基人赶快把手动更新的维基人解脱出来。第一个版本简陋，但勉强算是能更新。同时我也得知了另一位维基人也已经在用他的方式，在实现同样甚至更复杂的功能。我以为我可以就此收手了，但我没想到我还是在大家的期待下，让一个简陋的机器人变得复杂起来。

**补充1：自动填充hash值**。这个功能如果徒手实现的话可能还要了解sha1的算法。但我们的目的是功能有无，而不是完全徒手实现。所以简单地引入一个Lua常用的sha1库[^sha1]，问题就基本上解决了。我们不用操心具体的位运算细节，它会自动判断哪个位运算库可用，就用哪个。在Liangent的实现中，看到了她使用了digest函数，一度让我困惑。不过看文档后发现digest其实也就是简单的合并一下字符串而已。

**补充2：设计实现保证多个条目的type各不相同算法**。Liangent的bot似乎每次只更新一个条目，这样的逻辑确实比较简单，只要这一个条目和剩下5个不一样就完事了。但是对于我的方案，我打算允许一次更新多个条目。在我心目中，算法最终的结果应该满足下面这些条件：
- 不管更新几个条目，这几个条目相互之间的type要不同，它们的type也不能在其他未撤下的老DYK条目中
- 允许设置一个`MAX_UPDATES`参数，限制最多更新的条目数量
- 在满足前两个限制的前提下，更新的条目应该是较早提名的优先；同时，应当尽量尝试更新更多的条目。

于是，我设计了下面的算法[^pseudocode]
```lua
function GetNewDykResult(old_entries, typeTable, entries)
    INPUT: old_entries(当前DYK), typeTable(新条目的type字典), entries(已过滤的新条目列表)
    OUTPUT: update_ones(最终要更新的条目列表), old_ones(要保留下来的老DYK列表)
    
    typeTable = typeTable.filter( type not in (types from old_entries) )
    -- typeTable.length是我们要更新的条目数
    -- 过滤后的新条目数大于等于MAX_UPDATES的话，直接更新这些
    if typeTable.length >= MAX_UPDATES then
        return reverse( entries.filter( type in typeTable ) ) AS update_ones,
               old_ones[1:6-typeTable.length] AS old_ones
    end
    
    -- 一点点调整要更新的条目数
    while typeTable.length > 0 do
        compli_entries = old_entries[1:6-typeTable.length] -- complementary entries
        typeTable = typeTable.filter( type not in (types from compli_entries) )
        if typeTable.length 不减小 then -- 说明这些新条目的type满足限制
            return reverse( entries.filter( type in typeTable ) ) AS update_ones,
                   compli_entries AS old_ones
        end
    end
end
```
用这个算法，我就可以拿到我想要更新的条目，进行更新了。

**补充3：网络不好的情况处理**。因为最近的网络环境比较不好，身处大陆调维基的API难免慢或者不响应。我其实试过，很多不响应的时候再次调一下就好了。所以就进行了处理。由于我用的Zerobrane自带的LuaSec 0.6，本身没有写超时的代码，不过很简单，在
```lua
local _M = {
  _VERSION   = "0.6",
  _COPYRIGHT = "LuaSec 0.6 - Copyright (C) 2009-2016 PUC-Rio",
  PORT       = 443,
  TIMEOUT    = 30
}
```
开头这里加上TIMEOUT，然后在SSL握手之前，写上
```lua
self.sock:settimeout(_M.TIMEOUT)
```
就行了。LuaSec 0.8没有这个问题。在超时之后，HTTPS返回的值就是`timeout`或者`wantread`了，遇到这个状态的话，处理一下就好了。

当然，即便这样，也不能完全放心。如果存档存到一半，三次连不成功，或者其他异常的话，我就把已经存档的页面记录下来了。起初我打算拿简单的table来记，后来发现同一个条目有多个页面要存档的问题，所以就改成多层的table了。不过多层table想要打印下来我想最懒的办法就是JSON序列化了。这就是我的处理。

## 结语
用Lua编写维基机器人的尝试，我觉得最大的意义已经不是这个机器人本身了。它给我了一个Lua的运用场景，也让我，一个初学者学到了如何用Lua发HTTPS请求，处理网络问题以及简单的异常。同时，也为大家提供一个易用的Lua写的MediaWiki的API，其实也就是登入登出、获取页面当前版本、以及编辑啦。以后有编写Wiki的机器人方面，也多了Lua这种选择。[∎](../ "返回首页")

[^Popular]: 如果不知道那些库比较流行的话，推荐去看一下LuaRocks的官网，上面有下载排名。
[^ZeroBrane]: 比如LuaForWindows，或者LuaRocks自带的Lua，我想大概是因为它们都是MSVC编译的，所以解读不了ZeroBrane这个MinGW编译的dll吧。
[^sha1]: Implementation of SHA-1 and HMAC-SHA-1 in pure Lua. https://github.com/mpeterv/sha1
[^pseudocode]: 这个伪代码的语法是按我的心意写的，Lua为基础，但又像python和JS或者SQL，但我想比纯代码容易看懂。
