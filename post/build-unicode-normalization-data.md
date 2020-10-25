# 构建Unicode归一化数据

什么是Unicode归一化数据呢？顾名思义，就是把Unicode进行归一化，以方便统一地进行处理。我之所以着手做这项工作，一个重要原因是我看到了前人在这方面做过的努力，我希望做一份实用性更强，并且兼顾可读性的归一化数据。

在这份数据中，我采用“字形”作为依据来进行归一化，这一点恰好契合了一篇Unicode技术标准的要求，也就是《[tr39：Unicode安全机制](http://www.unicode.org/reports/tr39/)》一文。该文提到了一种“骨架算法”（Skeleton algorithm），用于比较两个Unicode字符是否为形近字。在该算法的解释中提到两次运用NFD来拆解Unicode。NFD是Normalization Form Canonical Decomposition的缩写，是一个Unicode归一化的标准，用来将一个字拆解为组成这个字的各个**基础部分**。[^nfd] 在骨架算法中还用到了Unicode形近字（confusables）库，这个我后面也会用到。但我在第一步没有了解到这一点。

那么构建这样一份数据的意义何在呢？我根据我个人的想法总结以下几点供大家参考：

1. 破开伪装（antispoof）。在网站用户注册方面，破坏者可能会注册与正常用户形近的用户。维基百科的用户注册就加了这方面限制，与其他用户名的Unicode形近的用户名，直接禁止注册。
2. 内容审查。在开放编辑的百科（如维基百科），以及论坛、聊天群组中，常常需要对特定的词汇进行控制。然而就会有一些用户使用Unicode意义上的形近字避开审查。当然如果想要更强，可以结合[IDS数据](https://github.com/cjkvi/cjkvi-ids)，或是[Unihan数据](https://unicode.org/charts/unihan.html)的读音，来把更广泛的相似的字也囊括在内。
3. 简化代码。在字符串匹配中，如果我们想同时匹配简繁体，或者形近字也匹配上，往往会在正则表达式里面用class语法，比如`[电電]影`。但在使用归一化数据处理一遍文字之后，可以避免这样的语法。

下面就让我来说一下我具体是怎样构建数据的。虽然构建完数据，其实就是一个简单的对应表，但想要基于其他数据集，构建一个符合我们预期的归一化数据，还是需要一套合适的流程的。那么我就介绍一下。

## 初版：ccnorm

有了想法之后，我就在网上查找相关的数据。维基百科的**防滥用过滤器**（Abuse Filter）中的ccnorm函数是我首先想到的。因为我们维基百科的开放性，破坏者层出不穷。全自动的过滤器的存在大大减轻了我们人工巡查的工作，在用户提交编辑的时候，先进过滤器，如果过滤器通不过，就根本不会提交到正式的条目历史中去。

ccnorm正是过滤器语法提供给我们使用的一个函数，效果就像下面这样

```
ccnorm("w1k1p3d14") => "WIKIPEDIA"
ccnorm("ωɨƙɩᑭƐƉ1α") => "WIKIPEDIA"
```

阅读代码，我发现这个函数引用的是另一个库的数据，叫做[Equivset](https://github.com/wikimedia/Equivset)。Equivset从字面就能看出来，equivalent set嘛。也是WMF官方的一个库。采用PHP将原始数据处理成更方便使用的格式。基金会似乎真的是偏好PHP。一个完全没有必要用到PHP的地方都要秀一下PHP。

这个库正是我想要的，它会把拉丁文的A和希腊文的A画等号。还会把美元符号$和拉丁文S等价。但我没想到它不止于此。打开它的原始数据，我发现这样的描述：

> 我们试图包括以下类型的对等:
> * 大小写合并。虽然不同字母的字母在视觉上是不同的，但是熟悉字母表的人很容易把它们搞混。两个大小写不同的单词可以理解为同一个单词。这是一种流行的假冒其他用户的方法。
>  
> * 视觉上相似的字符。跨字母系统的字符对也包括在内，但是这些字符对往往会在文字系统中产生错误的合并，因此应该避免。本软件实现了对跨字母系统的字符串的一揽子限制，这使得跨字母系统的字符对大部分是多余的。
>  
> * 中文简繁体对应.
>
> 本列表是基于尼尔·哈里斯制作的一个列表，那个列表是通过未知的方法得出的。该列表还包含音译对，我们认为这些对过多，并试图删除。例如，拉丁字母E和H被认为是等价的，因为西里尔字母“Н”（看起来像拉丁语H）的拉丁音译是“E”。

起初我认为它的中文字符只是简繁体对应，但我发现并非如此，它会还会把形近的字归在一起，正如我们前面提到的Unicode confusable干的事那样。但正如这个描述，这是Neil Harris通过不知什么办法搞出来的，但经过我认真的检查，发现确实准确性较高。连一些古汉语通假字都认为是等价的，这让我感觉很不可思议。经过调查，这个Neil Harris是一个活跃在Unicode邮件列表的人，我觉得比较可信，所以我会把这份数据作为基础，来构建我自己的ccnorm数据。

事实上我之所以不直接用这份现成的ccnorm，而再次处理的原因之一是，这份列表关于中文简繁体的部分有时会归到繁体，甚至异体字上面。虽然Unicode tr39提到，skeleton算法关注的是把形近字归一化，并不会考虑归一化后的可读性。但我希望，我构建的数据集是关注这一点的，而且是以简体中文为中心的。所以我的第一想法就是把我之前用过的简繁转换对应表找过来。大概就是这样：

```lua
local simp = '万与丑专业丛东丝丢两严丧个丬丰临'
local trad = '萬與醜專業叢東絲丟兩嚴喪個爿豐臨'
local t2s = {}
for s, v, e in trad:gmatch('()([%z\1-\127\194-\244][\128-\191]*)()') do
  t2s[v] = simp:sub(s, e-1)
end
```

这套转换是网上广为流传的。也不知道是谁整理的，很早以前就有。有了这个对应表之后，对于不符合这个规则的，调一下顺序就好。但是这个简繁转换的库实在是不全。而且如果同一组里找错了转换的对象，会对后面可读性造成影响。不过出来的结果还算满意，只不过总是要因为有些字符没有找到合适的转换，而无法进行正确的交换。为此，我增加了更强大的OpenCC单字转换库。OpenCC是最流行的开源简繁转换库，它的数据也确实很好用，有了它的数据，我几乎不需要手工再去补充简繁数据了。但异体字依然有一定数量。

我终于意识到或许有更简便的算法。我直接拿国标的字去每一组候选字里找不就完了吗，费劲找繁简对应干什么。那么国标的汉字列表去哪里找呢？我先搜索了GB2312，然后从一个维基百科的链接里找到了**通用规范汉字表**这个名词，于是在维基文库的原始文档里找到了整个列表。与其自己去wikitext里面取出来处理，不如找GitHub上别人处理好的。一开始我找到了[chinese_character](https://github.com/lunatao/chinese_character)这个项目，然后成功的写出了改版后的ccnorm。效果好多了，好到我可以去QQ群通知大家帮我测试了。

## 增强版：eccnorm

也许读到上面你会以为我已经完成了，其实我当时也确实觉得差不多了。可是我发现我忽略了什么。没错，有些汉字即便是在规范汉字表中，也是出现多个。这让我想起了我看到通用汉字表的时候，好像分了一级、二级、三级的。于是我再回GitHub，找到[common-standard-chinese-characters-table](https://github.com/shengdoushi/common-standard-chinese-characters-table)这个项目，里面有分好级的数据。于是代码重新写过，成为了下面这样子：

```lua
for line in io.lines('equivset.txt') do
  local equiv = line:split(' ')
  
  local swapped = false
  -- in tgscc level 1
  for i, v in ipairs(equiv) do
    if std_level1[v] then
      equiv[1], equiv[i] = v, equiv[1]
      swapped = true
      break
    end
  end
  -- in tgscc level 2 (省略代码)
  ...
  -- in tgscc level 3 (省略代码)
  ...

  -- 对于没有swap过的组合，再用OpenCC的简繁转换库刷一遍
  if not swapped then
    local dict_simp = cc_t2s[equiv[1]] or cc_t2s[equiv[2]] or cc_t2s[equiv[3]] or cc_t2s[equiv[4]] or cc_t2s[equiv[5]] or cc_t2s[equiv[6]] or cc_t2s[equiv[7]] or cc_t2s[equiv[8]] or cc_t2s[equiv[9]]
    if dict_simp then
      for i = 2, #equiv do
        if dict_simp == equiv[i] then
          equiv[1], equiv[i] = dict_simp, equiv[1]
          break
        end
      end
    end
  end

  for i = 2, #equiv do
    equivset[equiv[i]] = equiv[1]
  end
  ...
end
```

你或许看出了我的意图。经过精细处理的归一化库甚至可以作为简繁转换库来使用。虽然有合并到其他汉字的可能，但一定是简体字，而且是比这个字更常用的字。所以一般不会出错。因为常用的字永远是优先的。而我们日常接触到的文本中也大部分是常用字。

这就是ccnorm的最后一版。也是eccnorm的基础。要知道，群友永远有出不完的花样。果然没经过多久测试，就暴露出ccnorm的数据不足的问题了，这主要是因为我们一开始作为基础的Equivset在收集数据上是不足的缘故。据我猜测，Equivset的数据很多都是基于非官方人工收集，虽然已经足够好了，但是不够全。尤其表现在连NFD的映射表都不能囊括，还有就是Unicode官方提供的Confusables没有融入进来。

举个例子，Unicode有一个区域叫做康熙部首的，英文叫Kangxi radicals，存着一些和正常汉字长得一模一样的字，但是作为偏旁部首存在，所以独立占一个位置。比如这个字“⼼”，看着像“心”，但是你用程序去比，会发现不相等。下图是康熙字典里面汉字的部首分布，蛮有意思，所以给大家展示在这里。

![Kangxi Radicals](https://upload.wikimedia.org/wikipedia/commons/d/dd/Radicals_frequency_table.png)

通过Confusables就可以了把这部分补上，而且Confusables里面还有大量其他语种的homoglyph的例子，如果融合了这部分，那我的数据集将会上一个新台阶。不过由于我认为会带来比较大的影响，所以重新起名eccnorm，意为extended ccnorm。

那么话不多说我们来看看实现细节。首先我们NFD数据用的是WMF的另一个库Scribunto的ustring里面的[normalization-data.lua](https://github.com/wikimedia/mediawiki-extensions-Scribunto/blob/master/includes/engines/LuaCommon/lualib/ustring/normalization-data.lua)。这个数据直接就是Lua的，实在没有再好用啦。另外我们还会用到之前生成ccnorm没有提到的normset，也就是一个从归一化后的文字逆向对应的表，形如下面这样

```lua
return {
	["殴"] = { "毆" },
	["殷"] = { "慇" },
	["毁"] = { "毀", "譭" },
	["毂"] = { "軲", "轂", "轱" },
	["每"] = { "毎" },
	["毕"] = { "畢", "罼", "鏎" }
}
```

处理Confusables的代码大致如下，`homo_pairs`即ccnorm：

```lua
for a, b in confusables:gmatch('%( ([^ ]+) → ([^ ]+) %)') do
  -- 首先读取原始字符 a 和归一化后的字符 b
  -- 注意排除掉LEFT-TO-RIGHT MARK，在从右向左写的文字里很常见
  a = a:gsub('\226\128\142', '')
  b = b:gsub('\226\128\142', ''):gsub('%(', ''):gsub('%)', '')
  
  -- 排除掉我们想人工忽略的 a
  if ignore[a] then goto continue end
  
  -- 当 a 和 b 都是单个 Unicode 的时候我们才会接受
  if a:match('^[%z\1-\127\194-\244][\128-\191]*$') and
      b:match('^[%z\1-\127\194-\244][\128-\191]*$') then
    -- 如果 b 不是数字，且在 ccnorm 里面有，那么我们要让 a 归一化成 ccnorm(b)
    if not tonumber(b) and homo_pairs[b] then
      -- 为什么要排除 I 呢，因为不排除的话会有被刷成 L 的风险
      if a ~= 'I' and homo_pairs[a] ~= 'I' then
        homo_pairs[a] = homo_pairs[b]
      end
    -- 如果 b 是数字，则直接归一化为 b：因为群友反馈把数字归一化为字母太激进
    elseif tonumber(b) then
      homo_pairs[a] = b
    else
      -- 剩下就是 ccnorm 里面没有的情况了，我们要小心试探一下 ccnorm(a)
      -- 如果没有，那就看看 a 是不是已经是归一化的结果了，即检查 normset[a]
      -- 如果是，那么我们新的 norm 也是 a 就行了
      local norm = homo_pairs[a] or (normset[a] and a)
      if norm and norm ~= b then
        -- 对于是英文字母的，我们直接让 a 与 b 都归一化为 norm
        if norm:match('^[A-Z]$') then
          homo_pairs[a] = norm
          homo_pairs[b] = norm
        -- 其他的要特殊处理：除了让 a 归一化为 b 以外，还要让所有原来 ccnorm(x) = a
        -- 的 x 也都归一化到 b，并把 b 插入到 normset 中，避免后续出错
        else
          local a_set = normset[norm]
          for _, v in ipairs(a_set) do
            homo_pairs[v] = b
          end
          normset[b] = a_set
          homo_pairs[a] = b
        end
      -- 其余情况统统让 a 归一化到 b 即可
      else
        homo_pairs[a] = b
      end
    end
  else
    -- print(b, b:byte(1, 15))
  end
  ::continue::
end
```

从上面的代码中可以看出，我是更加信任Unicode Confusables的，给了它更高的优先级。但是它有个问题就是英文字母归一化没有Equivset更加全面，所以如果是英文字母的话我们进行了特殊操作。此外我还利用Confusables的数据把原来ccnorm的数字纠正了，一旦有Confusable的指向存在，直接忽略原来的ccnorm。

接下来就是NFD的事情了。从下面的代码可以看出，基本上就是最Unicode的范围做了一些排除，尤其是长得奇奇怪怪的那种。因为我要拿出它NFD后的第一个字符作为归一化的结果，如果不排除的话，很多附加符的混合也被归一化成单个附加符了，没有必要。所以直接抛弃他们比较方便。与Confusables对比，可以看出NFD的结果我给它的优先级比ccnorm低，一旦有ccnorm，那我就会避免采用NFD的结果。

```lua
for k, v in pairs(norm_data.decomp) do
  local a = utf8char(k)
  local b = utf8char(v[1])
  local flag = true
  if k >= 0x0900 and k <= 0x09FF or k >= 0x0B00 and k <= 0x0DFF or
    k >= 0x0F00 and k <= 0x0FFF or k >= 0x1B00 and k <= 0x1B7F or
    k >= 0x2200 and k <= 0x22FF or k >= 0x2190 and k <= 0x21FF or
    k >= 0x2A00 and k <= 0x2AFF or k >= 0x11100 and k <= 0x1137F or
    k >= 0x1D100 and k <= 0x1D1FF then
    flag = false
  end
  local norm = homo_pairs[b] or b
  if flag then
    if norm:match('^[A-Z]$') or not homo_pairs[a] then
      homo_pairs[a] = norm
    end
  end
end
```

这其中有一个工具函数是用的我自己的实现，就是utf8char，把Unicode转成UTF-8编码。应该是在全网都没有相同的实现。因为常见的实现都会限制在4个字节内（即最高编码到`U+1FFFFF`），我这个实现是自己瞎搞的，所以不必在意4个字节的限制，超出4个字节就会继续，可以编到`U+7FFFFFFF`都没有问题。虽然[RFC 3629](https://tools.ietf.org/html/rfc3629#page-11)限制了UTF-8只能编码到`U+10FFFF`，但不要让RFC限制我们的想象嘛，哈哈。

```lua
local function utf8char(unicode)
  local char = string.char
  if unicode <= 0x7F then return char(unicode) end

  local continue_flag = bit.rshift(unicode, 6)
  local bytes = {}
  local fill = 0xFF80
  
  repeat
    bytes[#bytes + 1] = 0x80 + bit.band(unicode, 0x3F);
    unicode = bit.rshift(unicode, 6)
    
    continue_flag = bit.rshift(continue_flag, 5)
    fill = bit.rshift(fill, 1)
  until continue_flag == 0
  bytes[#bytes + 1] = bit.band(fill, 0xFF) + unicode;
  
  return char(unpack(table.reverse(bytes)))
end
```

在这些数据的加持下，我的eccnorm就终于完成了，代码也上传到了https://github.com/AlexanderMisel/ccnorm 。

## 实际运用时的小改进

在实际使用中，遇到群友使用**附加符号**（diacritics）捣乱的情形。的确，对于标准的Unicode归一化我们游刃有余了，但是加上了diacritics的文字又变得难以匹配了。但还好diacritics在Unicode的范围非常集中，所以我就稍稍排除了一下，大家可以参考这段代码

```lua
teststr = teststr:gsub('[%z\1-\127\194-\244][\128-\191]*', function(p)
  local unicode = utf8to32(p)
  if unicode >= 0x0300 and unicode <= 0x036F or
    unicode >= 0x1DC0 and unicode <= 0x1DFF or
    unicode >= 0x20D0 and unicode <= 0x20FF or
    unicode >= 0xFE20 and unicode <= 0xFE2F then
    return ''
  end
  return equivset[p] or p
end)
```

这样c̳̻͚̻̩̻͉̯̄̏͑̋͆̎͐ͬ͑͌́͢h̵͔͈͍͇̪̯͇̞͖͇̜͉̪̪̤̙ͧͣ̓̐̓ͤ͋͒ͥ͑̆͒̓͋̑́͞ǎ̡̮̤̤̬͚̝͙̞͎̇ͧ͆͊ͅo̴̲̺͓̖͖͉̜̟̗̮̳͉̻͉̫̯̫̍̋̿̒͌̃̂͊̏̈̏̿ͧ́ͬ̌ͥ̇̓̀͢͜s̵̵̘̹̜̝̘̺̙̻̠̱͚̤͓͚̠͙̝͕͆̿̽ͥ̃͠͡也可以就可以了直接转换为CHAOS了，一步到位。这就是有关构建Unicode归一化数据的内容。[∎](../ "返回首页")

[^nfd]: 这是我自己的描述。其实准确定义NFD是不好定义的。这里“基础部分”与汉字拆解意义不同。它强调的是把附加符拆掉（比如把**ü**拆成**u**和**¨**），以及把合字拆开（比如把德语字母**ß**拆成**ss**）。而拆解汉字实际类似于转换成**IDS**（表意描述序列）。所以二者是不同的。

