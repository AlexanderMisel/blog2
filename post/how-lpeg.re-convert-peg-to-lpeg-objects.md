# LPeg.re是如何把PEG转换成LPeg对象的

> 本文主要面向已经了解解析表达文法（PEG）和LPeg基本使用的读者

我们知道LPeg是Lua的PEG库，但是它因为要与Lua结合，所以使用的时候跟标准的PEG有区别。但它提供了一个LPeg.re库，可以将我们用文字编写的PEG文法转换成LPeg内部的对象，就仿佛我们使用LPeg原生的写法编写了一个解析器一样，非常神奇。这神奇的操作就是在re.lua这个文件中实现的，它同样编写了一个parser，就是把我们的PEG转成内部形式。那我们来看看它是如何实现的吧。

```lua
local pattern = S * m.Cg(m.Cc(false), "G") * exp / mm.P * (-any + patt_error)
```

我们从最终生成这个parser的pattern看起。

```lua
pattern <- (S {:G: '' -> false :} exp) -> P
           (!. / '' -> patt_error)
```

S首先跳过所有空格或者注释，然后把G这个这个命名匹配置为false，再然后匹配我们的exp（表达式）。这些如果能够匹配上的话，就把匹配结果作为参数传给P。不过这还没完，如果匹配完之后，已经到字符串结尾了，那OK，匹配得没问题；否则就返回pattern错误。嗯，还算比较容易理解的。

这里的`patt_error`函数接受两个参数，s（输入字符串）和i（当前位置）。这是function capture语法赋予它的。

## Exp

接下来我们就要看这个核心`Exp`到底匹配出了个啥。

```lua
Exp = S * ( m.V"Grammar" + m.Cf(m.V"Seq" * ("/" * S * m.V"Seq")^0, mt.__add) );
```

翻译成正常的PEG：

```lua
Exp <- S (Grammar / ( Seq ('/' S Seq)* ) ~> __add )
```

Exp分为Grammar或者Alternative嘛，这不难理解。但是它匹配完Alternative进行了一下fold capture，而且用metatable的`__add`方法，也就是说它其实映射到了LPeg中的`+`符号，这正好是有序选择的运算符，没错。

## Suffix

后面Seq和Prefix的文法根据类似，就是把我们原来字符串表示的文法转换成运算符。满足原来LPeg的用法。我们重点还是要看一下Suffix这个文法。先分析一个分支

```lua
Suffix_1 <- ( 
              Primary S ('+' ''-> { 1, __pow } S)*
            )~> function (a,b,f) return f(a,b) end
```

首先匹配Primary，跳过空格，然后匹配任意多个`+`运算符，把捕获两个常量，1和`__pow`，最后层层fold起来。那么a、b、f都是什么呢？a其实是Primary里的捕获，b是1，f是`__pow`。所以`f(a,b)`的意思就是`a^1`，在LPeg里面，这代表a匹配1+次。

再看一个稍微复杂一些的，Cmt捕获。

```lua
Suffix_2 <- ( 
              Primary S ("=>" * S * defwithfunc(m.Cmt) S)*
            )~> function (a,b,f) return f(a,b) end
```

这里的`defwithfunc`是用来生成函数的

```lua
local Def = m.C(name) * m.Carg(1)

local function defwithfunc (f)
  return m.Cg(Def / getdef * m.Cc(f))
end
```

首先这个Def我来告诉你是干什么的，它首先捕获了一下你调的函数的名字，然后用了一个很少用的函数Carg，这个是把你之前调match时多传的第一个参数拿出来

```lua
pattern:match(p, 1, defs)
```

我们看到我们构建pattern时调用match时除了pattern、p、1还多传了一个defs的参数。这个参数传进去了之后如何用吗？就要用Carg函数把它重新取出来。现在Def实际创建了两个捕获。这两个捕获会传递给`getdef`函数

```lua
local function getdef (id, defs)
  local c = defs and defs[id]
  if not c then error("undefined name: " .. id) end
  return c
end
```

`getdef`函数也就是做一下判断，defs里面有没有这个id（就是我们用name规则匹配的），有的话就返回`defs[id]`。现在我们拿到要用的函数了。我们看到最后连接了一个f的常量捕获。当我们把Cmt传进来的时候，它就是Cmt这个函数的常量捕获。好了，现在我们同样凑齐了之前的a、b、f了。于是我们最终使用的就是

```lua
Cmt(Primary, defs[id])
```

符合文档所说的定义。

## Grammar

Primary的文法几乎就是字面性的处理，将字符串接收进来，然后传给相应的LPeg函数。既然如此类似，自然不必一个个解释。那么，值得我们研究一下的地方就是每一条Definition是如何合并到一个文法的。在LPeg中我们知道定义一个文法是通过`LPeg.P{}`实现的。也就是我们整个文法内部就是要构造一个符合LPeg文法规则的table。这就用到了`adddef`函数。

```lua
local function adddef (t, k, exp)
  if t[k] then
    error("'"..k.."' already defined as a rule")
  else
    t[k] = exp
  end
  return t
end
```

可以发现它传入了三个参数，第一个参数是一个table，也就是最终用来存放文法的table；第二个k是table的key，用来指明这个规则的名称；而exp则是这条规则的LPeg对象，而这个对象是Exp这条rule捕获到的结果。通过这样，一条条的假如到t中，我们就构建了一个完整的LPeg文法。

```lua
Grammar = m.Cg(m.Cc(true), "G") *
          m.Cf(m.V"Definition" / firstdef * m.Cg(m.V"Definition")^0,
            adddef) / mm.P
```

我们同样把它翻译成正常的PEG：

```lua
Grammar <- ({:G: '' -> true :} (Definition -> firstdef
           {: Definition :}*) ~> adddef) -> P
```

将rule合并起来，然后传给P规则，构建一个grammar。但grammar并不一定是顶层。在LPeg中，最顶层的是Exp，而一个Exp可以由grammar构成，也可以由多个seq构成。

那么问题来了。为什么我们在pattern开始把G这个捕获置为false，而到Grammar里置为true了呢？我们知道命名捕获就相当于一个标记，相同的命名捕获后面会覆盖掉前面。所以，当最后一次捕获Grammar的时候，如果成功，那么最终结果就会是成功。

那么哪里用到G了呢？我们倒回去发现有一个Primary长下面这模样

```lua
Primary <- ( (name !arrow / '<' name '>') '' -> G ) -> NT
```

也就是说把name和G两个参数传给了NT呗。这个一看就是引用另一个non-terminal的文法，那么看开NT检验了点啥呢？

```lua
local function NT (n, b)
  if not b then
    error("rule '"..n.."' used outside a grammar")
  else return mm.V(n)
  end
end
```

哦，我们看到b如果是false，它就认为rule n是在grammar之外，就报错；反之，就正常返回V(n)。那么我们倒回去想，为什么G为false就在Grammar外呢？因为我们第一开始设置了G为false，如果一直没进Grammar，那就一直不会成为false。只要一进Grammar，那么它就会是true，不管里面是否嵌套其他的Grammar，它都会是true。因此G可以用于检测是否位于Grammar内。

但是，如果内层Grammar引用外层的rule，或者外层Grammar引用内层的rule会怎样？这就不是re这个模块操心的事情了，而是交由LPeg判断这个rule是否存在。

## trace函数

作为补充，我想要讲一下trace函数。这不是re自带的一个函数，是网上大神编写的一段代码。一直以来，我就是靠这个函数来调试LPeg代码的。它把主文法中非终结符Grammar最后的P替换成了自定义的trace函数就实现了实时打印匹配过程的功能，让我们能够知道LPeg究竟是在哪一步匹配出了问题。那么这个神奇的trace函数为什么可以实现这个呢？我们来看它的定义

```lua
local function trace(grammar)
  if type(grammar) ~= "table" then return grammar end
  local level = 0
  local start = {}
  for k, p in pairs(grammar) do
    if mm.type(p) == "pattern" then
      local trout = function (ch, indent)
        ...
      end
      local enter = lpeg.Cmt(lpeg.Cp(), trout("?", 1))
      local leave = lpeg.Cmt(lpeg.Cp(), trout("!", -1)) * (lpeg.P(1) - lpeg.P(1))
      local eq = lpeg.Cmt(lpeg.Cp(), trout("=", -1))
      grammar[k] = enter * p * eq  + leave
    end
  end
  return grammar
end
```

我们看到，跟P函数一样，trace函数也是接收grammar作为参数，但返回依然是grammar，并非一个LPeg pattern。所以实际上本质上就是一个echo函数。但在文法里，它是一个函数捕获，如果不加这个捕获，就仍然是它内部的那些捕获，就会出错。

这个函数会遍历整个grammar的table，只要这个table中某个item是pattern的话，它就会将这个pattern改写成这样（原来的pattern记为p）

```lua
pattern <- enter p eq / leave
enter   <- {} => trout('?', 1)
leave   <- {} => trout('!', -1) (!. .)
eq      <- {} => trout('=', -1)
```

我相信这不难理解，在进入之前，先输出判断是否符合；然后匹配内部规则；匹配完之后，能匹配上，那肯定就eq了嘛。leave这条规则很有趣，它结尾写得那个`!. .`是说无论如何这条规则都会失败。所以这条规则虽然进了，但一定会回溯到起始位置。之所以需要用Cmt捕获，是因为只有着一种捕获是不管成功或是不成功，都会调用函数的。[∎](../ "返回首页")
