# Lua连接数据库与FTP

在使用Lua以来，我一直想解决的一个问题就是连接数据库。而最近，我终于能够通过Lua连上MySQL数据库了。所以想给大家分享一下。另外我还想说一下Lua连FTP的内容。说实话二者没什么联系，主要是因为我最近做了一个既用得上数据库，又用得上FTP的小任务。

## Lua连数据库

我会主要说一下连接MySQL数据库。MySQL在开源关系型数据库里算是最流行的一个了。我司也在使用MySQL。所以连接MySQL也是我的重要需要之一。如果没有数据库连接能力，Lua确实也可以开发Web服务，以及一些有用的功能，但如果没有数据库连接能力的话，可能即便能操作数据，也无法入库，只能在内存里存着，或者用自己的方式存文件。解析起来没有数据库容易，数据量大了的话，也会很慢。

SQL有自己处理磁盘上数据的方式。能够用它成熟的策略去磁盘中读取数据。SQL还有自己的处理数据的方式。对于处理数据来说，SQL语言显得非常便捷，虽然也有表达能力不如编程语言的问题。但如果我们用编程语言调用SQL的话，就可以在编程语言中弥补这部分问题了。

好啦，不多说废话了。搜遍互联网，就会发现这方面的资料真的是很少。而且几乎都指向LuaSQL这个库。如果说还有别的话，大概就是LuaDBI这个库（我最近才发现还有这个库）。首先，其实如果能花时间了解[MySQL的协议](https://dev.mysql.com/doc/internals/en/client-server-protocol.html)的话，是一定能手写一个连接库的。在OpenResty的生态里，连接MySQL有一个库，叫做[lua-resty-mysql](https://github.com/openresty/lua-resty-mysql)，是OpenResty的创造者章亦春手写的。能够明显看出他的意图，就是按我上面说的那样，直接按照MySQL的协议与MySQL通信，而不是在一个现成库基础上调用它的库函数的。

我一开始其实也有改造一下他这个库的想法。毕竟我搂了一眼，发现它除了依赖ngx的socket模块不让我喜欢以外，其他的部分其实都还好。它使用ngx模块的想法我也能理解。因为这是OpenResty的特色之一，用nginx的socket来弥补。但我不想对nginx依赖太多。另外一方面考虑是手写的这个库可能没有实现MySQL的一些功能，只是基本的连接和使用。但是其他的一些库，又找不到二进制，我自己尝试编译也没成功。所以长期以来，我都没解决Lua连库的问题。

不过，我最近关注到一个Lua发行版，叫做[luapower](https://luapower.com/)，它和ulua一样，都是基于LuaJIT的，而且是MinGW编译的。二进制下载就可以用。luapower自带的MySQL连接库很是全面，它是使用FFI调用MySQL或者MariaDB的dll来访问MySQL的，实现的功能比较全面。如果我日后用到什么功能，也不用担心还没有实现了。

相比LuaSQL，我觉得它的文档是相当全的。我在了解到luapower的MySQL连接库以后，轻松地就连上了MySQL数据库。不过值得注意地一点是，如果用libmariadb这个库的话，需要把zlib这个库也安装上，以为有依赖关系。

在MySQL之外，可能大家用的比较多的数据库是PostgreSQL。我知道有人想说是Oracle。用Oracle的话，可能你真的需要编译一下LuaSQL了。如果你的Oracle就是一个中间库的话，你又想用脚本连的话，或许可以考虑用python连。因为Oracle官方提供了一个叫做cx_Oracle的python库，用它连肯定顺手啊。还是说回PostgreSQL。我个人感觉[pgmoon](https://github.com/leafo/pgmoon)这个库就不错。一个原因是leafo这个人做了很多lua的周边库，他还创造了MoonScript语言，以及一个我看着还不错的Web框架Lapis。另一个原因是[这篇文章](https://leafo.net/guides/using-postgres-with-openresty.html)提到的它跟其他同类库的对比，说得还挺有道理的。

这里我就不上代码了。因为我现在也就是在用几个基本的函数执行简单的查询。怎么调一查文档全知道。

## Lua连FTP

连接FTP本身就是LuaSocket的一个功能。不过LuaSocket的文档有点简略，所以如果想用FTP的各种命令，而不局限于GET和PUT的话，就得阅读一下ftp.lua的源码了。官方文档了也提到，使用底层接口，用户可以轻松创建自己的函数来访问FTP协议支持的任何操作。那就让我们来看看我做了些什么吧。我先放代码

```lua
local socket = require('socket')
local ftp    = require('socket.ftp')
local ltn12  = require('ltn12')
local url    = require('socket.url')

open_ftp = socket.protect(function(host, user, pwd)
  local f = ftp.open(host)
  f:greet()
  f:login(user, pwd)
  return f
end)

scan_folder = socket.protect(function (f, u)
  local t = {}
  local gett = url.parse(u)
  gett.command = 'nlst'
  gett.sink = ltn12.sink.table(t)
  f:pasv()
  f:receive(gett)
  return table.concat(t);
end)

retrieve = socket.protect(function(f, u)
  local t = {}
  local gett = url.parse(u)
  gett.sink = ltn12.sink.table(t)
  f:pasv()
  f:receive(gett)
  return table.concat(t)
end)

local fhandle = open_ftp('xx.xx.xx.xx', 'alexmisel', 'password')
local the_files = scan_folder(fhandle, 'ftp://xx.xx.xx.xx/abc/'):split('\r?\n')
for i, v in ipairs(the_files) do
  local file_str = retrieve(fhandle, 'ftp://xx.xx.xx.xx/abc/' .. v)
  local f = io.open(v, 'wb')
  f:write(csv_str)
  f:close()
end
```

以上代码我重新实现了打开FTP连接、扫描目录中的文件以及获取文件。并在下面调用这三个函数，实现了基本的连接FTP，获取某个目录的文件，并且下载里面的所有文件。我为什么没有用库里的那个GET呢？因为我觉得它每次不管干什么都重新open、greet、login实在是太没必要了，而且我看人家别的语言或者客户端连接FTP，似乎是可以保持连接的。虽然就几行代码，但我确实遇到了一些坑，这里跟大家分享一下子。

第一个我要分享的地方就是`PASV`这个命令，或者说是FTP的传输模式。首先说坑在哪儿。就是你不管receive什么东西，都需要先发一个`PASV`命令。我第一开始封装login函数的时候，把`PASV`给封进去了。

第二个关于`socket.protect`的。我们用底层函数重新封的函数最好都要加这个。我最近就遇到这里面函数报错，直接导致LuaJIT程序崩溃。主要这种错误用Lua本身的`pcall`还挡不住，所以还是得用LuaSocket自带的`socket.protect`，这样还可以把真正的错误传给第二个返回值（第一个为`nil`）。

第三个是编码的事。因为我接触的FTP就是用微软的FTP搭的，所以编码是GBK的。我把文件下载到Windows刚好也是GBK编码的，所以文件名不会出现乱码。不过如果是Linux的话，或许需要转码。

不过说到字符集转换，使用最广泛的就是iconv库了。不过这个库也是经常让我很折腾。由于我是在Windows下开发，所以只要Windows没解决，那就是没解决问题。找了许久终于找到了FFI的解决方案，那就是[aqua](https://github.com/semyon422/aqua)这个看起来不知名连README都没有的工程里的iconv.lua。说实话我以前是编译过iconv的，所以实在不行的话，我可能会去编译LuaJIT版的[lua-iconv](https://ittner.github.io/lua-iconv/)（因为luapower实在太香了），毕竟我以前成功编译过Lua 5.1版的。

或许还有第四个坑，我发现我自己上传文件到FTP上，但并没有重现这个问题。但是我在实际使用的时候发现文件已经增加了，但是我的扫描却没有扫到的问题。我的解决方案就是在每次`scan_folder`之前重新登录一次，就像原本的实现那样。

---

总而言之，通过以上技术，我能够顺利地访问操作数据库，以及FTP。FTP的上传函数我没有写，但如果大家需要，可以参考库本身自带的`put`函数进行修改。再次重申，本文所有Lua库的选择已经站在LuaJIT的角度上。用过Lua的应该都清楚，LuaJIT的FFI模块是不受原生Lua支持的，所以使用原生的同学请不要照搬。[∎](../ "返回首页")