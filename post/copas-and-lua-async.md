# Copas与Lua的异步请求

这次的话题Copas算是我积压一段时间的一个坑，现在快过年了，终于有时间写了。

在Lua语言里，大家可能很少听到异步这个词。因为Lua本身是没有多线程的。但在JS中，我们已经非常习惯异步这个处理方式了。而且异步在处理多个请求中非常高效。在只是收发一两个请求的时候，异步不异步其实无所谓。但是在上百上千个请求的时候，异步的优势就很明显了。

Lua真的可以异步请求吗？很多人跟我一样曾经有这个疑问。因为大家对Lua单线程这个基本知识点的印象根深蒂固。虽然JS也算是单线程，但它有浏览器这个靠山啊，浏览器可以替它调度异步的请求，从而使它的异步请求完全不必阻塞。

那么在Lua如果像实现异步就有两条路可走

1. 利用协程（Coroutine）以及某种机制，在单线程里解决调度问题

2. 利用宿主语言实现一个库，搞出多线程或者其他解决方案

在lua-users的wiki上，[有一个页面](http://lua-users.org/wiki/MultiTasking)专门整理多任务处理的Lua库。这些库基本上也就是众多Lua的Web框架的基础，大家可以深入了解。这里面的分类比我科学一些，主要就是两大类，**协作式**（Cooperative）和**抢占式**（Preemptive）。

> 协作式环境下，下一个进程被调度的前提是当前进程主动放弃时间片；抢占式环境下，操作系统完全决定进程调度方案，操作系统可以剥夺耗时长的进程的时间片，提供给其它进程。（维基百科）

而基于协程的实现是属于协作式的。而Copas就是使用这种方式的一个库。我使用Copas并不是说推荐大家用Copas，而是因为两个小小的原因：

1. Copas不用编译，是一个纯Lua库。

2. Copas使用的是Lua本身支持的协程

在Lua的官方教程[PIL](https://www.lua.org/pil/9.4.html)中，就提到Copas所使用的dispatcher方案。要实现一个简单的Web服务器，确实有个dispatcher就足够了。原理其实就是一个永久循环，在循环里恢复执行协程。而异步的特性是通过LuaSocket的timeout实现的。它会把timeout设置为0，或者很小的数字。这样就能避免阻塞下面的循环。

```lua
function dispatcher ()
  while true do
    local n = table.getn(threads)
    if n == 0 then break end   -- no more threads to run
    local connections = {}
    for i=1,n do
      local status, res = coroutine.resume(threads[i])
      if not res then    -- thread finished its task?
        table.remove(threads, i)
        break
      else    -- timeout
        table.insert(connections, res)
      end
    end
    if table.getn(connections) == n then
      socket.select(connections)
    end
  end
end
```

有同学可能会想问，超时之后不就接不到了嘛？但其实并不是这样。超时之后其实我们并没有关闭socket。从上面的示例代码中我们可以看出，超时的会在下一轮循环里继续请求，直至请求结束。在这种设定下，我们在进行HTTP请求的时候，就不用等待上一个请求出结果再继续下一个请求了。

但说实话，这种方式在一开始用的时候还是会有些不习惯的。还有就是，如果用的人不太了解细节可能达不到自己想要的效果。而Copas就是把它的实现细节封装了起来，虽然仍然避免不了加一个循环，但调用起来已经简单了不少。而且Copas在内部结合了LuaSocket和LuaSec，不用我们再分别引入这些库。

就比如，我在条目推送服务（[mwtest/feed_service.lua](https://github.com/AlexanderMisel/mwtest/blob/type/feed_service.lua)）里写的Copas HTTPS GET请求的函数

```lua
function chttpsget(req_url)
  MediaWikiApi.trace('CHTTP request')
  local res = {}
  local _, code, resheaders, _ = chttp.request {
    url = req_url,
    protocol = 'tlsv1_2',
    headers = {
      ['User-Agent'] = string.format('mediawikilua %d.%d', 0, 2),
      ['Accept-Language'] = 'zh-cn'
    },
    sink = ltn12.sink.table(res)
  }

  MediaWikiApi.trace('  Result status:', code)
  return table.concat(res), code, resheaders
end
```

可以说，这里的代码都已经比较上层了，不会再需要写直接处理套接字的代码。在Copas请求的最外层，一定要有一个`copas.addthread`，因为它会帮你创建一个Copas工作的函数，然后里面你进行什么操作都行。有人可能想问，在里面继续加thread行不行？当然可以。那我们加thread，和不加thread的区别在哪儿呢？

这里我就要解释一下了。Copas的每个thread的内部是阻塞的，但thread和外部、thread之间是不阻塞的。我们在一个请求之后，或许又要带出多个请求，就比如在feed_service里，我在第一个请求里获取到了热门条目列表之后，我要通过获取摘要接口，逐一获取条目的摘要。这时候，我们就需要在里面继续增加thread。代码大致如下：

```lua
function getTopView(new_date)
  local res, code = chttpsget('https://wikimedia.org/api/rest_v1/metrics/' ..
    'pageviews/top/zh.wikipedia.org/all-access/' .. data_str)
  if code ~= 200 then
    return -- Failed to get topviews
  end

  local raw_topview = json.decode(res).items[1].articles
  local taskset = limit.new(10)
  for _, v in ipairs(raw_topview) do
    local art_name = v.article
    if not art_name:match(':') and not list_match(spamlist, art_name) then
      taskset:addthread(function()
        local disp_name, extract = getSummary(art_name)
      end)
    end
  end
end
```

大家可能注意到，我用了limit，这是我后来才加的。这是因为如果不加限制，会将所有的请求一下都塞给底层库，底层一下子同时请求会导致socket的select出现问题。而Copas自带的limit库就能解决这个问题。我把请求数限制在了10个以内，这样就不需要我人工去sleep解决这样的问题了。

到这里，大家对Copas的HTTP(S)请求应该有了一定了解。它的请求语法与LuaSocket是一致的。我最早其实是用LuaSec原生请求的，切换成Copas基本上就是引个lua文件的事。

---

这个feed_service在网络条件较好的情况下，可以说事又快又稳的。但是像维基百科这样的境外网站，难免会有访问慢的时候。另外就是，有时候不是慢，就是发1000个请求，总是有那么几个，它就是不响应。这样的话，Copas就会一直一直尝试，如果我没关注的话，也许几天都卡在那儿了。

因为推送热门条目这件事，本来也不需要保证100%都下载下来，失败几个没有关系。Copas只有`addthread`，却没有`removethread`。所以我对Copas进行了patch。加入了如下代码：

```lua
function copas.removeall()
  _reading = newset()
  _writing = newset()
  _sleeping.times = {}
end
```

在请求一段时间之后，我在主循环里调用这个函数，把Copas内部保留的请求干掉，恢复一个干净的Copas，这样就不会总卡在Copas上了。[∎](../ "返回首页")
