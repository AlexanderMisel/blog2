# Lua日期库的运用——批量生成测试身份证号

批量生成身份证号这件事，或许是我用Lua做的第一件对工作有帮助的事情了。网上有生成身份证号的程序，一般来说或许不需要去自己写一个生成身份证号的程序。生成大量身份证号，当然目的只有一个，就是用于测试。比如我们某项业务是跟身份证号有关的，需要整大量不重复的身份证号，验证业务的稳定性，或者针对身份证号的算法的有效性（如针对身份证号的分表逻辑，后台批量导入的校验等），这就需要我这篇博客中提到的内容了。

当时我接到的任务非常简单，生成10000个身份证号，最好不是真实人的身份证号，可用于测试。这个任务对于当时Lua小白的我，正好用来练手

```lua
for i=10000, 19999 do print('1000001900010' .. ) end
```

就这么一行代码，我的10000条身份证号就来了

```
100000190001010000
100000190001010001
100000190001010002
100000190001010003
100000190001010004
100000190001010005
...
```

轻松愉快吧。要问我为什么从10000开始遍历，不从0开始遍历，因为我那时候不会`string.format`啊，哈哈哈。不会补0，于是干脆从10000开始。这批身份证号明显不是真实身份证号，当然

时隔两年，我又要生成身份证号了。不过这次要生成的更逼真，逼真得在线工具的校验都能通过。算法其实GitHub上面一搜一堆，没有什么难度。那么我为什么还写这篇博客呢？我写这篇博客肯定是有意义的啊。因为Lua在生成日期的时候遇到了困难，1970年之前的日期不好随机生成。虽然自己去处理一下闰年好像也不费事，但是就要整个一套年月日算法都自己写了。我还是对网上现成库抱有希望，所以我就找了找。

Lua相关的日期库还真不好找，到处都是说1970年以前的时间无法处理。要么就是说，我这好好的啊，怎么你那不行。Windows确实不行，原因似乎是微软提供的mktime函数只能处理1970年以后的日期。但奇怪的是，我在Firefox里用JS分明能建立很久以前的时间，而且没出任何问题。

我找到了两个库能够解决这个问题luatz以及LuaDate。这两个库都能支持非常广范围的日期，因为它们都是自己用Lua实现的日期算法。大家可以自行选择自己喜欢的库。LuaDate的代码可读性较差，luatz的可读性较强。但功能是差不多的。

下面是这两个库的用法

```lua
local date = require('date')
local gettime = require "luatz.gettime".gettime
local timetable = require "luatz.timetable"

-- date object
print(timetable.new(1900, 1, 1, 0))
print(date(1900, 1, 1))

-- current timestamp
print(os.time()) -- native
print(gettime()) -- luatz
print((date(true) - date(1970, 1, 1)):spanseconds()) -- LuaDate

-- timestamp of a given date
print(os.time{ year=1900, month=1, day=1 }) -- native, not applicable for time before 1970
print(timetable.new(1900, 1, 1, 0):timestamp()) -- luatz
print((date(1900, 1, 1) - date(1970, 1, 1)):spanseconds()) -- LuaDate

-- format timestamp
local oldest = os.time{ year=1970, month=1, day=1, hour=8 }
print(oldest)
print(os.date("!%Y-%m-%d %H:%M:%S", oldest)) -- native
print(timetable.new_from_timestamp(oldest):strftime('%Y-%m-%d %H:%M:%S')) -- luatz
print(date(oldest):fmt('%Y-%m-%d %H:%M:%S')) -- LuaDate

-- timezone added
print(os.date("%Y-%m-%d %H:%M:%S", oldest)) -- native
print(timetable.new_from_timestamp(oldest + 28800):strftime('%Y-%m-%d %H:%M:%S')) -- luatz
print(date(oldest):tolocal():fmt('%Y-%m-%d %H:%M:%S')) -- LuaDate
```

打印结果如下

```
1900-01-01T00:00:00.000
Mon Jan 01 1900 00:00:00.000000000
1615903200
1615903200
1615903200
nil
-2208988800
-2208988800
0
1970-01-01 00:00:00
1970-01-01 00:00:00
1970-01-01 00:00:00
1970-01-01 08:00:00
1970-01-01 08:00:00
1970-01-01 08:00:00
```

我这里只给大家展示一些常见用法。有了这个之后，生成一大堆身份证就不在话下了。无非是随机数。理解了吗？随机日期就是随机数，用随机数当作unix timestamp，灌到函数里，出来就是日期。我本来不打算把这个函数实现写到博客里的，但是我想这篇博客比较基础，还是写一下吧

```lua
local function rand_date()
  local rand_time = math.random(oldest_time, newest_time)
  local d = date(rand_time)
  return d:fmt('%Y%m%d')
end
```

没错，这样我们就把一个随机数转换成了一个在oldest_time与newest_time之间的日期。然后像下面这样一个循环生成100万个身份证。

```lua
local counter = 0
repeat
  local rand1 = math.random(zones_total)
  local rand2 = math.random(0, 999)
  local sfzh_start = zone_list[rand1] .. rand_date() .. string.format('%03d', rand2)
  if not hash[sfzh_start] then
    hash[sfzh_start] = true
    io.write(sfzh_start .. parity(sfzh_start) .. '\n')
    counter = counter + 1
  end
until counter == 1000000
```

不知道在Java里你们是怎么处理1970年以前的时间的。Java是否能够很好地处理1970年以前的时间呢？

本篇博客可能有点入门级了。好像没有那么高大上，我想刚入门Lua的小朋友也能看懂吧。希望能帮你们解决这一点点关于Lua时间库的疑惑。或许生成一批身份证号，是你学会编程以后第一个想写的程序呢？[∎](../ "返回首页")

