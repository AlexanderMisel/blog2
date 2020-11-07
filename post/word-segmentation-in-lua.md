# Lua编写中文分词

中文分词是中文相关的自然语言处理（NLP）避不开的一个问题。成熟的分词工具有不少，Python语言的“结巴”分词就是一个有名的例子。但找遍网络，却很难找到一个用Lua编写的中文分词。很多人说，现在NLP都是用Python，没人会去拿Lua去搞这个。但我想，原理是一样的，那便可以实现。就算Lua操作UTF-8字符串没有Python方便，也不是没有办法。所以我更要写一个。

在中文分词领域，有很多种方法。大概分为三大类：

- 基于词表的分词方法
- 基于统计模型的分词方法
- 基于序列标注的分词方法

本文中采用的方法就属于基于统计模型的分词方法。它的名字可以叫做**最大概率**分词法。所谓最大概率分词，就是让分词后的组合，总体概率最大。最近我读了很多相关的博客，虽然有的读得懂，有的读不懂。不过有一篇博客很好，《[最小熵原理（一）：无监督学习的原理](https://www.spaces.ac.cn/archives/5448)》，给了我启发。我们分词的方向就应该是向熵减小的方向走。熵减小，意味着我们学习成本会降低，这是自然语言发展的必然规律。
$$
-\sum_{k=1}^n \ln p(w_k)=-\ln\prod_{k=1}^n p(w_k)
$$
让每个词概率乘积最大，就是在让句子的总信息量减小。按照这个思路，我编写了我的一元分词算法。在开始分词之前，我要先把它切分成句子，句子有标点，是天然的分隔。让我们随手写个LPeg文法把它分开吧

```lpeg
article <- {| (punct / {sentence})+ |}
sentence <- ([^\226\227\239]+ / !punct .)+
punct <- '，'/'。'/'《'/'》'/'、'/'？'/'：'/'；'/'“'/'”'/'‘'
          /'’'/'｛'/'｝'/'【'/'】'/'（'/'）'/'…'/'￥'/'！'
```

这里我小小优化了一次，就是你们排除掉`\226`，`\227`和`\239`这一点。因为常见标点的开头都是这三个，如果不是这三个的话，可以大胆地匹配啦。用这个文法匹配完，我们的文章就切分成一句一句了。下面是分词了。

## 词频库的构建

我首先采用的是Google Books的n-gram数据中的1-gram。由于Google Books的数据提示我们，1900年的中文和现代中文的语法有很大区别，所以我打算直接抛弃1919年之前的数据。

```lua
local tf = {}
local tf_count = 0
do
  local tf_dict = {}
  for line in io.lines('zh-50k') do
    local list = line:split('\t')
    local word, class = list[1]:match('^([^_%s]+)_?([^%s]*)')
    if word and not word:match('^[%d%a%p]+$') then
      local count = 0
      for i = 2, #list do
        local year, num = list[i]:match('^(%d+),(%d+)')
        if num and tonumber(year) > 1919 then
          count = count + tonumber(num)
        end
      end
      local val = tf_dict[word]
      if val then tf_dict[word] = val + count
      else tf_dict[word] = count end
    end
  end
  
  for k, v in pairs(tf_dict) do
    tf_count = tf_count + 1
    tf[tf_count] = { word = k, count = v }
  end
end
```

大概的逻辑就是上面这样子。我之所以用`tf_dict`来辅助，是因为Google的数据里面同一个词可能出现多次。也是我一开始没注意这个，导致我分词结果很不理想。后来我发现，概率怎么比实际的低呢？原来是这个原因。把重复的合并之后在放到`tf`数组中，输出到最终文件即可。为了计算的方便，我直接存储的就是以10为底的对数词频。

用类似的方法，我还处理了结巴分词的词频数据。因为我发现结巴分词的词汇更多，我把它作为Google n-gram数据的补充。

## 分词算法
其实首先我只考虑了纯中文的情况。代码像下面这样。这是一个非常简单的动态规划（DP），参考了[Fast Word Segmentation of Noisy Text](https://towardsdatascience.com/fast-word-segmentation-for-noisy-text-2c2c41f9e8da)的C#实现。

```lua
function wordseg(input, maxlen)
  -- memoization: check wheather input has already calculated,
  -- if yes then return from cache
  local best_comp = cache[input]
  local cached_seg, cached_prob
  if best_comp then return best_comp
  else cached_seg, cached_prob = '', -math.huge end
  
  local input_len = input:ulen()
  local i = 0
  local part1 = ''
  
  for char, pos in input:gmatch('([%z\1-\127\194-\244][\128-\191]*)()') do
    part1 = part1 .. char
    i = i + 1
    
    -- logarithmic probability of part1
    local prob_log_part1 = dict[part1]
    if not prob_log_part1 then
      prob_log_part1 = (1 - i) - logN
    end
    
    local seg, prob_log_sum = '', 0
    if i < input_len then
      seg, prob_log_sum = unpack(wordseg(input:sub(pos), maxlen))
    end
    
    if i == 1 or prob_log_part1 + prob_log_sum > cached_prob then
      if i == input_len then
        cached_seg, cached_prob = part1, prob_log_part1
      else
        cached_seg, cached_prob = part1 .. ' ' .. seg, prob_log_part1 + prob_log_sum
      end
    end
    
    if i == maxlen then break end
  end
  best_comp = { cached_seg, cached_prob }
  cache[input] = best_comp
  return best_comp
end
```

唯一一点特别的就是对**未登录词**的处理
$$
P=\frac{1}{N}\cdot10^{length(w)-1}
$$
这个经验公式是来自于Peter Norvig的《[Natural Language Corpus Data](http://norvig.com/ngrams/ch14.pdf)》第224页。这个公式其实用在中文里需要一些改变，因为我感受到了他这个公式的作用，其实就是对未登录词的概率与词汇长度的关系的一种拟合。在不经修改地使用这个公式的时候，我发现，如果我稍微把`maxlen`放长一些的话，我就会分出很多错误的长词。于是我意识到，这个公式对于长词汇的“惩罚”是不够的。上面这个等式左右取对数后的结果是这样的：
$$
\log P=-\log N + (1-length(w))
$$
经过我改过的版本是这样的：
$$
\log P = -\log N + 3\left(1 - length(x)^{1.618}\right)
$$
看着参数比较随性，我喜欢黄金分割，但效果还不错。我之所以在长度上加一个指数，是因为我发现不加的话，每增多一点长度，所带来的概率对数减少是恒定的，那么比如一个4字词语，如果把它切成两个词，那么切成1+3或者2+2的对数概率是一样的。我这样处理就会导致我实际惩罚了长词，同样是两个未登录词，2+2的概率会超过1+3。另外3这个因数我们也可以强行解释一波，传闻中文的单字信息熵是英文单个字母的3倍左右，这也会导致我们中文词汇长词绝对比英文要稀有。

在改变参数之后，我发现，即便我把单词最常字数`maxlen`设得很长，也不会分出很长的未登录词。在这个基础上，我又对英文和符号做了特殊处理，不再和中文一起进行分词。相关方法大家都写得出来，我就不再详述，代码已经开源在了[AlexanderMisel/wordseg](https://github.com/AlexanderMisel/wordseg)。

下面展示一下示例结果。最后的数字显示的是对数概率

```
2019 冠状 病毒 病 疫情	-20.121127701026
是 一次 由 严重 急性 呼吸系统 综合征 冠状 病毒 2	-41.055221433488
SARS-CoV-2	0
所 引发 的 全球 大 流行 疫情	-22.499061054205
疫情 最初 在 2019 年 12 月 于 中华人民共和国 湖北省 武汉市 被 发现	-37.007315340909
随后 在 2020 年初 迅速 扩散 至 全球 多 国	-29.88401149632
逐渐 变成 一场 全球性 大 瘟疫	-26.639993206034
被 多个 国际 组织 及 传媒 形容 为 自 第二次世界大战 以来 全球 面临 的 最 严峻 危机 以及 史上 最 严重 的 公共卫生 事件	-80.64401710208
截至 2020 年 10 月 26 日	-11.510173046091
全球 已有 189 个 国家 和 地区 累计 报告 逾 4,292.6 万名 确诊 病例	-46.971024063816
其中 逾 115 万人 因而 死亡	-20.252364569748
  目前 研究 表明	-9.0942226048959
2019 冠状 病毒 病 可能 于 2019 年 10 月 至 11 月 进入 人类 社会 并 开始 传播	-48.406662729899
而 目前 明确 已知 的 首宗 感染 病例 于 2019 年 12 月 1 日 在 武汉市 发病	-52.767046531696
首位 前往 医院 就诊 的 患者 可能 出现 于 12 月 12 日	-37.654022658898
12 月 26 日	-5.0421246767479
武汉市 呼吸 与 重症 医学科 医生 张继 先 最早 发现 和 上报 此 不明 原因 肺炎	-68.43161788726
并 怀疑 该 病 属 传染病	-22.953996667558
```

总得来说，这个分词结果还是超出我的预期的。因为我没有利用2-gram，只单纯利用了1-gram就达到了这样的效果。[∎](../ "返回首页")